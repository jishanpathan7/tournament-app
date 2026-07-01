"""Password hashing, opaque tokens, access-JWT, and auth cookie helpers.

Framework-light: no FastAPI/`api` imports (only starlette `Response` for the cookie
helpers), so it unit-tests in isolation. ``decode_access`` raises ``TokenError``
(framework-agnostic); the API layer (``app/api/auth_context.py``) maps that to an
``AuthenticationError`` Problem Details.
"""

from __future__ import annotations

import datetime
import hashlib
import secrets
import uuid
from dataclasses import dataclass
from typing import Any

import jwt
from passlib.context import CryptContext
from starlette.responses import Response

from app.core.config import Settings, get_settings

# Argon2id only — greenfield, no legacy hashes to migrate. `deprecated="auto"` still
# flags hashes whose params drift from current for transparent rehash on next login.
# (Add "bcrypt" to schemes if pre-existing bcrypt hashes ever need importing.)
_pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


class TokenError(Exception):
    """An access token is missing, malformed, expired, or of the wrong type."""


# --- Passwords -------------------------------------------------------------
def hash_password(raw: str) -> str:
    return _pwd_context.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return _pwd_context.verify(raw, hashed)
    except Exception:  # noqa: BLE001 - any malformed hash verifies as False
        return False


def password_needs_rehash(hashed: str) -> bool:
    return _pwd_context.needs_update(hashed)


# --- Opaque tokens (refresh / email-verify / password-reset / csrf) --------
def new_opaque_token() -> str:
    return secrets.token_urlsafe(32)


def new_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(raw: str) -> str:
    """sha256 hex — what we store for refresh/verify/reset tokens (never the raw)."""
    return hashlib.sha256(raw.encode()).hexdigest()


# --- Access JWT ------------------------------------------------------------
@dataclass(frozen=True)
class AccessClaims:
    user_id: uuid.UUID
    session_id: uuid.UUID
    organization_id: uuid.UUID | None
    org_role: str | None
    remember: bool = False


def encode_access(
    *,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    organization_id: uuid.UUID | None,
    org_role: str | None,
    remember: bool = False,
    settings: Settings | None = None,
) -> str:
    settings = settings or get_settings()
    now = datetime.datetime.now(datetime.timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "sid": str(session_id),
        "typ": "access",
        "rmb": remember,
        "iat": now,
        "exp": now + datetime.timedelta(seconds=settings.access_token_ttl),
        "jti": secrets.token_urlsafe(8),
    }
    if organization_id is not None:
        payload["org"] = str(organization_id)
        payload["role"] = org_role
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access(
    token: str, *, settings: Settings | None = None, verify_exp: bool = True
) -> AccessClaims:
    """Decode + verify an access token. ``verify_exp=False`` lets ``/refresh`` read
    the active org & remember flag out of an EXPIRED (but signature-valid) cookie."""
    settings = settings or get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"verify_exp": verify_exp},
        )
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc
    if payload.get("typ") != "access":
        raise TokenError("wrong token type")
    try:
        user_id = uuid.UUID(payload["sub"])
        session_id = uuid.UUID(payload["sid"])
    except (KeyError, ValueError) as exc:
        raise TokenError("malformed token") from exc
    org = payload.get("org")
    return AccessClaims(
        user_id=user_id,
        session_id=session_id,
        organization_id=uuid.UUID(org) if org else None,
        org_role=payload.get("role"),
        remember=bool(payload.get("rmb", False)),
    )


# --- Cookies ---------------------------------------------------------------
def _shared_cookie_kwargs(settings: Settings, *, secure: bool, remember: bool) -> dict[str, Any]:
    kwargs: dict[str, Any] = {"secure": secure, "samesite": settings.cookie_samesite}
    if settings.cookie_domain:
        kwargs["domain"] = settings.cookie_domain
    if remember:
        # Persistent cookie; otherwise a session cookie (cleared on browser close).
        kwargs["max_age"] = settings.refresh_token_ttl
    return kwargs


def set_auth_cookies(
    response: Response,
    *,
    access_token: str,
    refresh_token: str,
    csrf_token: str,
    secure: bool,
    remember: bool = False,
    settings: Settings | None = None,
) -> None:
    settings = settings or get_settings()
    shared = _shared_cookie_kwargs(settings, secure=secure, remember=remember)
    response.set_cookie(
        settings.access_cookie_name, access_token, httponly=True, path="/", **shared
    )
    # Refresh cookie scoped to the auth endpoints — limits its exposure surface.
    response.set_cookie(
        settings.refresh_cookie_name,
        refresh_token,
        httponly=True,
        path=f"{settings.api_v1_prefix}/auth",
        **shared,
    )
    # CSRF cookie is readable by JS (double-submit): the FE echoes it in X-CSRF-Token.
    response.set_cookie(settings.csrf_cookie_name, csrf_token, httponly=False, path="/", **shared)


def set_access_cookie(
    response: Response, access_token: str, *, secure: bool, settings: Settings | None = None
) -> None:
    """Re-mint only the access cookie (used by org-switch — refresh is untouched)."""
    settings = settings or get_settings()
    shared = _shared_cookie_kwargs(settings, secure=secure, remember=False)
    response.set_cookie(
        settings.access_cookie_name, access_token, httponly=True, path="/", **shared
    )


def clear_auth_cookies(response: Response, *, settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    domain = settings.cookie_domain
    response.delete_cookie(settings.access_cookie_name, path="/", domain=domain)
    response.delete_cookie(
        settings.refresh_cookie_name, path=f"{settings.api_v1_prefix}/auth", domain=domain
    )
    response.delete_cookie(settings.csrf_cookie_name, path="/", domain=domain)
