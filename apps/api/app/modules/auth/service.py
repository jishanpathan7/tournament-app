"""Auth use cases. Raises AppError subclasses; NEVER commits (the dependency owns
the transaction). User-level security events go to structured logs (no org context)."""

from __future__ import annotations

import datetime
import logging
import uuid
from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import (
    AuthenticationError,
    ConflictError,
    NotFoundError,
    RateLimitedError,
    ValidationError,
)
from app.core.config import get_settings
from app.core.db import session_scope
from app.core.oauth import OAuthUserInfo
from app.core.ports import EmailChannel, LoginThrottle
from app.core.security import (
    decode_access,
    encode_access,
    hash_password,
    hash_token,
    new_csrf_token,
    new_opaque_token,
    password_needs_rehash,
    verify_password,
)
from app.core.throttle import LoginThrottleError
from app.db.enums import AuthTokenPurpose, OrgRole
from app.db.models import AuthSession, AuthToken, Identity, Membership, User
from app.modules.auth import repository as repo
from app.modules.auth.schemas import MeResponse, OrgSummary

logger = logging.getLogger("app.auth")

_ROLE_PRECEDENCE = {
    OrgRole.OWNER: 5,
    OrgRole.ADMIN: 4,
    OrgRole.ORGANIZER: 3,
    OrgRole.SCOREKEEPER: 2,
    OrgRole.VIEWER: 1,
}


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


@dataclass
class TokenBundle:
    access_token: str
    refresh_token: str
    csrf_token: str
    remember: bool


@dataclass
class AuthResult:
    bundle: TokenBundle
    user: User
    organization_id: uuid.UUID | None
    org_role: OrgRole | None
    memberships: Sequence[Membership]


def _select_default_membership(memberships: Sequence[Membership]) -> Membership | None:
    """Default active org for a multi-org login: highest role, then oldest membership."""
    if not memberships:
        return None
    return max(
        memberships,
        key=lambda m: (_ROLE_PRECEDENCE.get(OrgRole(m.org_role), 0), -m.created_at.timestamp()),
    )


def build_me(
    user: User,
    organization_id: uuid.UUID | None,
    org_role: OrgRole | None,
    memberships: Sequence[Membership],
) -> MeResponse:
    return MeResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        email_verified=user.email_verified_at is not None,
        active_organization_id=organization_id,
        active_role=org_role,
        organizations=[
            OrgSummary(
                id=m.organization.id,
                slug=m.organization.slug,
                name=m.organization.name,
                role=OrgRole(m.org_role),
            )
            for m in memberships
        ],
    )


async def _issue_session(
    session: AsyncSession,
    *,
    user: User,
    organization_id: uuid.UUID | None,
    org_role: OrgRole | None,
    remember: bool,
    ip: str | None,
    user_agent: str | None,
    family_id: uuid.UUID | None = None,
    parent_id: uuid.UUID | None = None,
) -> TokenBundle:
    settings = get_settings()
    raw_refresh = new_opaque_token()
    auth_session = AuthSession(
        user_id=user.id,
        token_hash=hash_token(raw_refresh),
        family_id=family_id or uuid.uuid4(),
        parent_id=parent_id,
        expires_at=_now() + datetime.timedelta(seconds=settings.refresh_token_ttl),
        user_agent=user_agent,
        ip=ip,
    )
    session.add(auth_session)
    await session.flush()  # populate auth_session.id
    access = encode_access(
        user_id=user.id,
        session_id=auth_session.id,
        organization_id=organization_id,
        org_role=org_role.value if org_role else None,
        remember=remember,
    )
    return TokenBundle(
        access_token=access,
        refresh_token=raw_refresh,
        csrf_token=new_csrf_token(),
        remember=remember,
    )


async def register(
    session: AsyncSession, *, email: str, name: str, password: str, email_channel: EmailChannel
) -> User:
    if await repo.get_user_by_email(session, email) is not None:
        raise ConflictError("That email is already registered")
    user = User(email=email, name=name, password_hash=hash_password(password))
    session.add(user)
    await session.flush()
    await _issue_email_token(
        session,
        user=user,
        purpose=AuthTokenPurpose.EMAIL_VERIFICATION,
        template="verify_email",
        ttl=get_settings().email_verification_token_ttl,
        email_channel=email_channel,
    )
    logger.info("auth.registered", extra={"user_id": str(user.id)})
    return user


async def authenticate(
    session: AsyncSession,
    *,
    email: str,
    password: str,
    remember: bool,
    ip: str | None,
    user_agent: str | None,
    throttle: LoginThrottle,
) -> AuthResult:
    key = f"{email.lower()}|{ip or '-'}"
    try:
        await throttle.check(key)
    except LoginThrottleError as exc:
        raise RateLimitedError("Too many attempts. Try again later.") from exc

    user = await repo.get_user_by_email(session, email)
    if user is None or not user.password_hash or not verify_password(password, user.password_hash):
        await throttle.record_failure(key)
        logger.info("auth.login_failed", extra={"email": email.lower()})
        raise AuthenticationError("Invalid email or password")

    await throttle.reset(key)
    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
    user.last_login_at = _now()

    memberships = await repo.list_memberships(session, user.id)
    default = _select_default_membership(memberships)
    org_id = default.organization_id if default else None
    org_role = OrgRole(default.org_role) if default else None
    bundle = await _issue_session(
        session,
        user=user,
        organization_id=org_id,
        org_role=org_role,
        remember=remember,
        ip=ip,
        user_agent=user_agent,
    )
    logger.info("auth.login_succeeded", extra={"user_id": str(user.id)})
    return AuthResult(bundle, user, org_id, org_role, memberships)


async def oauth_login(
    session: AsyncSession, *, info: OAuthUserInfo, ip: str | None, user_agent: str | None
) -> AuthResult:
    """Log in (or provision) a user from a verified OAuth identity. Links to an
    existing account by email; creates a passwordless user otherwise."""
    identity = await repo.get_identity(session, info.provider, info.subject)
    if identity is not None:
        user = await repo.get_user_by_id(session, identity.user_id)
    else:
        user = await repo.get_user_by_email(session, info.email)
        if user is None:
            user = User(
                email=info.email,
                name=info.name,
                password_hash=None,
                email_verified_at=_now() if info.email_verified else None,
            )
            session.add(user)
            await session.flush()
        session.add(
            Identity(user_id=user.id, provider=info.provider, provider_subject=info.subject)
        )
    if user is None:  # pragma: no cover - identity FK guarantees the user exists
        raise AuthenticationError("OAuth login failed")
    if info.email_verified and user.email_verified_at is None:
        user.email_verified_at = _now()
    user.last_login_at = _now()

    memberships = await repo.list_memberships(session, user.id)
    default = _select_default_membership(memberships)
    org_id = default.organization_id if default else None
    org_role = OrgRole(default.org_role) if default else None
    bundle = await _issue_session(
        session,
        user=user,
        organization_id=org_id,
        org_role=org_role,
        remember=True,
        ip=ip,
        user_agent=user_agent,
    )
    logger.info("auth.oauth_login", extra={"user_id": str(user.id), "provider": info.provider})
    return AuthResult(bundle, user, org_id, org_role, memberships)


async def _recover_active_context(
    session: AsyncSession, user: User, access_token: str | None
) -> tuple[uuid.UUID | None, OrgRole | None, bool]:
    """On refresh, keep the active org + remember flag from the (maybe expired) access cookie."""
    remember = False
    if access_token:
        try:
            claims = decode_access(access_token, verify_exp=False)
        except Exception:  # noqa: BLE001 - any decode failure → fall back to default
            claims = None
        if claims is not None:
            remember = claims.remember
            if claims.organization_id is not None:
                membership = await repo.get_membership(session, user.id, claims.organization_id)
                if membership is not None:
                    return claims.organization_id, OrgRole(membership.org_role), remember
    memberships = await repo.list_memberships(session, user.id)
    default = _select_default_membership(memberships)
    if default is not None:
        return default.organization_id, OrgRole(default.org_role), remember
    return None, None, remember


async def rotate(
    session: AsyncSession,
    *,
    raw_refresh: str,
    access_token: str | None,
    ip: str | None,
    user_agent: str | None,
) -> AuthResult:
    current = await repo.get_auth_session_by_hash(session, hash_token(raw_refresh))
    if current is None:
        raise AuthenticationError("Invalid session")
    now = _now()
    if current.revoked_at is not None:
        # Replay of a rotated/revoked token → theft. Burn the whole family in an
        # INDEPENDENT transaction so it persists even though we then raise (which
        # rolls back the request transaction).
        async with session_scope() as fresh, fresh.begin():
            await _revoke_family(fresh, current.family_id)
        logger.warning(
            "auth.refresh_reuse_detected",
            extra={"user_id": str(current.user_id), "family_id": str(current.family_id)},
        )
        raise AuthenticationError("Session reuse detected")
    if current.expires_at < now:
        raise AuthenticationError("Session expired")

    user = await repo.get_user_by_id(session, current.user_id)
    if user is None:
        raise AuthenticationError("Invalid session")

    org_id, org_role, remember = await _recover_active_context(session, user, access_token)
    current.revoked_at = now  # rotate: revoke the presented token
    bundle = await _issue_session(
        session,
        user=user,
        organization_id=org_id,
        org_role=org_role,
        remember=remember,
        ip=ip,
        user_agent=user_agent,
        family_id=current.family_id,
        parent_id=current.id,
    )
    memberships = await repo.list_memberships(session, user.id)
    return AuthResult(bundle, user, org_id, org_role, memberships)


async def _revoke_family(session: AsyncSession, family_id: uuid.UUID) -> None:
    await session.execute(
        update(AuthSession)
        .where(AuthSession.family_id == family_id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=_now())
    )


async def revoke_session(
    session: AsyncSession, *, user_id: uuid.UUID, session_id: uuid.UUID
) -> None:
    auth_session = await session.get(AuthSession, session_id)
    if auth_session is None or auth_session.user_id != user_id:
        raise NotFoundError("Session not found")
    if auth_session.revoked_at is None:
        auth_session.revoked_at = _now()


async def revoke_all_sessions(session: AsyncSession, *, user_id: uuid.UUID) -> None:
    await session.execute(
        update(AuthSession)
        .where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=_now())
    )


async def list_sessions(session: AsyncSession, *, user_id: uuid.UUID) -> Sequence[AuthSession]:
    return await repo.list_active_sessions(session, user_id)


async def logout_current(session: AsyncSession, *, raw_refresh: str) -> None:
    """Revoke just the session behind the presented refresh token (idempotent)."""
    current = await repo.get_auth_session_by_hash(session, hash_token(raw_refresh))
    if current is not None and current.revoked_at is None:
        current.revoked_at = _now()


async def logout_all_by_refresh(session: AsyncSession, *, raw_refresh: str) -> None:
    current = await repo.get_auth_session_by_hash(session, hash_token(raw_refresh))
    if current is not None:
        await revoke_all_sessions(session, user_id=current.user_id)


async def _issue_email_token(
    session: AsyncSession,
    *,
    user: User,
    purpose: AuthTokenPurpose,
    template: str,
    ttl: int,
    email_channel: EmailChannel,
) -> None:
    raw = new_opaque_token()
    session.add(
        AuthToken(
            user_id=user.id,
            purpose=purpose,
            token_hash=hash_token(raw),
            expires_at=_now() + datetime.timedelta(seconds=ttl),
        )
    )
    await email_channel.send(user.email, template, {"token": raw, "name": user.name})


async def request_email_verification(
    session: AsyncSession, *, user_id: uuid.UUID, email_channel: EmailChannel
) -> None:
    user = await repo.get_user_by_id(session, user_id)
    if user is None or user.email_verified_at is not None:
        return  # idempotent no-op
    await _issue_email_token(
        session,
        user=user,
        purpose=AuthTokenPurpose.EMAIL_VERIFICATION,
        template="verify_email",
        ttl=get_settings().email_verification_token_ttl,
        email_channel=email_channel,
    )


async def confirm_email(session: AsyncSession, *, raw_token: str) -> None:
    token = await repo.get_active_auth_token(
        session, hash_token(raw_token), AuthTokenPurpose.EMAIL_VERIFICATION
    )
    if token is None or token.expires_at < _now():
        raise ValidationError("Invalid or expired token")
    token.consumed_at = _now()
    user = await session.get(User, token.user_id)
    if user is not None and user.email_verified_at is None:
        user.email_verified_at = _now()
        logger.info("auth.email_verified", extra={"user_id": str(user.id)})


async def request_password_reset(
    session: AsyncSession, *, email: str, email_channel: EmailChannel
) -> None:
    user = await repo.get_user_by_email(session, email)
    if user is None:
        logger.info("auth.password_reset_unknown_email")  # no enumeration → still 202
        return
    await _issue_email_token(
        session,
        user=user,
        purpose=AuthTokenPurpose.PASSWORD_RESET,
        template="password_reset",
        ttl=get_settings().password_reset_token_ttl,
        email_channel=email_channel,
    )


async def confirm_password_reset(
    session: AsyncSession, *, raw_token: str, new_password: str
) -> None:
    token = await repo.get_active_auth_token(
        session, hash_token(raw_token), AuthTokenPurpose.PASSWORD_RESET
    )
    if token is None or token.expires_at < _now():
        raise ValidationError("Invalid or expired token")
    token.consumed_at = _now()
    user = await session.get(User, token.user_id)
    if user is None:
        raise ValidationError("Invalid or expired token")
    user.password_hash = hash_password(new_password)
    await revoke_all_sessions(session, user_id=user.id)  # reset invalidates every session
    logger.info("auth.password_reset", extra={"user_id": str(user.id)})


async def change_password(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    current_session_id: uuid.UUID,
    current_password: str,
    new_password: str,
) -> None:
    user = await repo.get_user_by_id(session, user_id)
    if (
        user is None
        or not user.password_hash
        or not verify_password(current_password, user.password_hash)
    ):
        raise AuthenticationError("Current password is incorrect")
    user.password_hash = hash_password(new_password)
    # Revoke OTHER sessions (keep the one making the change).
    await session.execute(
        update(AuthSession)
        .where(
            AuthSession.user_id == user_id,
            AuthSession.id != current_session_id,
            AuthSession.revoked_at.is_(None),
        )
        .values(revoked_at=_now())
    )
    logger.info("auth.password_changed", extra={"user_id": str(user_id)})
