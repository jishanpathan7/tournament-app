"""Business logic for collaborative tournament management."""

from __future__ import annotations

import datetime
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ConflictError, NotFoundError
from app.core.events import emit_event
from app.core.security import hash_token, new_opaque_token
from app.db.enums import OrgRole, TournamentInviteStatus, TournamentRole
from app.db.models import TournamentInvite, TournamentMember
from app.modules.tournament_members import repository as repo

INVITE_TTL_DAYS = 7
_AGGREGATE = "tournament_member"

_ORG_BYPASS_ROLES: frozenset[str] = frozenset({OrgRole.OWNER.value, OrgRole.ADMIN.value})


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def _member_response(member: TournamentMember) -> dict[str, Any]:
    return {
        "id": str(member.id),
        "user_id": str(member.user_id),
        "tournament_id": str(member.tournament_id),
        "tournament_role": member.tournament_role,
        "name": member.user.name if member.user else "",
        "email": member.user.email if member.user else "",
        "invited_by": str(member.invited_by) if member.invited_by else None,
        "accepted_at": member.accepted_at,
        "created_at": member.created_at,
    }


def _invite_response(invite: TournamentInvite) -> dict[str, Any]:
    return {
        "id": str(invite.id),
        "email": invite.email,
        "tournament_id": str(invite.tournament_id),
        "tournament_role": invite.tournament_role,
        "status": invite.status,
        "expires_at": invite.expires_at,
        "created_at": invite.created_at,
    }


async def resolve_tournament_role(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    tournament_id: uuid.UUID,
    org_role: str,
) -> str | None:
    """Return the effective tournament role string for authz, or None if org-bypass."""
    if org_role in _ORG_BYPASS_ROLES:
        return None  # caller treats None as "full access"
    member = await repo.get_member(session, tournament_id, user_id)
    return member.tournament_role if member else None


async def list_members(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    tournament_id: uuid.UUID,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    members = await repo.list_members(session, tournament_id)
    invites = await repo.list_pending_invites(session, tournament_id)
    return [_member_response(m) for m in members], [_invite_response(i) for i in invites]


async def invite_member(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    tournament_id: uuid.UUID,
    actor_id: uuid.UUID,
    email: str,
    tournament_role: TournamentRole,
    email_channel: Any,
    tournament_name: str,
) -> TournamentInvite:
    email = email.strip().lower()

    # If user already has a platform account, add them directly
    existing_user = await repo.get_user_by_email(session, email)
    if existing_user is not None:
        already = await repo.get_member(session, tournament_id, existing_user.id)
        if already is not None:
            raise ConflictError("user is already a member of this tournament")
        member = TournamentMember(
            organization_id=org_id,
            tournament_id=tournament_id,
            user_id=existing_user.id,
            tournament_role=tournament_role.value,
            invited_by=actor_id,
            accepted_at=_now(),
        )
        session.add(member)
        await session.flush()
        await emit_event(
            session,
            aggregate=_AGGREGATE,
            event_type="tournament_member.added",
            payload={
                "tournamentId": str(tournament_id),
                "userId": str(existing_user.id),
                "role": tournament_role.value,
            },
        )
        # Still send a notification email
        await email_channel.send(
            email,
            "tournament_member_added",
            {
                "tournament_name": tournament_name,
                "role": tournament_role.value,
            },
        )
        # Return a synthetic invite-like object for the response
        now = _now()
        invite = TournamentInvite(
            organization_id=org_id,
            tournament_id=tournament_id,
            email=email,
            tournament_role=tournament_role.value,
            token_hash="",
            invited_by=actor_id,
            status=TournamentInviteStatus.ACCEPTED.value,
            expires_at=now,
            accepted_at=now,
            accepted_user_id=existing_user.id,
        )
        invite.created_at = now
        invite.updated_at = now
        return invite

    # External user — pending invite
    existing_invite = await repo.get_pending_invite(session, tournament_id, email)
    if existing_invite is not None:
        raise ConflictError("a pending invite already exists for this email")

    raw = new_opaque_token()
    invite = TournamentInvite(
        organization_id=org_id,
        tournament_id=tournament_id,
        email=email,
        tournament_role=tournament_role.value,
        token_hash=hash_token(raw),
        invited_by=actor_id,
        status=TournamentInviteStatus.PENDING.value,
        expires_at=_now() + datetime.timedelta(days=INVITE_TTL_DAYS),
    )
    session.add(invite)
    await session.flush()
    await session.refresh(invite)
    await emit_event(
        session,
        aggregate=_AGGREGATE,
        event_type="tournament_invite.created",
        payload={
            "tournamentId": str(tournament_id),
            "email": email,
            "role": tournament_role.value,
        },
    )
    await email_channel.send(
        email,
        "tournament_invite",
        {
            "token": raw,
            "tournament_name": tournament_name,
            "role": tournament_role.value,
        },
    )
    return invite


async def accept_invite(
    session: AsyncSession,
    *,
    raw_token: str,
    user_id: uuid.UUID,
    org_id: uuid.UUID,
) -> TournamentMember:
    invite = await repo.get_invite_by_token_hash(session, hash_token(raw_token))
    if (
        invite is None
        or invite.status != TournamentInviteStatus.PENDING.value
        or invite.expires_at < _now()
    ):
        raise NotFoundError("invite not found or expired")

    already = await repo.get_member(session, invite.tournament_id, user_id)
    if already is not None:
        invite.status = TournamentInviteStatus.ACCEPTED.value
        invite.accepted_at = _now()
        invite.accepted_user_id = user_id
        return already

    member = TournamentMember(
        organization_id=invite.organization_id,
        tournament_id=invite.tournament_id,
        user_id=user_id,
        tournament_role=invite.tournament_role,
        invited_by=invite.invited_by,
        accepted_at=_now(),
    )
    session.add(member)
    invite.status = TournamentInviteStatus.ACCEPTED.value
    invite.accepted_at = _now()
    invite.accepted_user_id = user_id
    await session.flush()
    await emit_event(
        session,
        aggregate=_AGGREGATE,
        event_type="tournament_member.added",
        payload={
            "tournamentId": str(invite.tournament_id),
            "userId": str(user_id),
            "role": invite.tournament_role,
        },
    )
    return member


async def update_member_role(
    session: AsyncSession,
    *,
    tournament_id: uuid.UUID,
    user_id: uuid.UUID,
    new_role: TournamentRole,
) -> TournamentMember:
    member = await repo.get_member(session, tournament_id, user_id)
    if member is None:
        raise NotFoundError("tournament member not found")
    member.tournament_role = new_role.value
    await session.flush()
    return member


async def remove_member(
    session: AsyncSession,
    *,
    tournament_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    member = await repo.get_member(session, tournament_id, user_id)
    if member is None:
        raise NotFoundError("tournament member not found")
    await session.delete(member)
    await session.flush()


async def generate_invite_link(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    tournament_id: uuid.UUID,
    actor_id: uuid.UUID,
    tournament_role: TournamentRole,
) -> tuple[str, datetime.datetime]:
    """Create a TournamentInvite with no email sent. Returns (raw_token, expires_at)."""
    raw_token = new_opaque_token()
    token_hash = hash_token(raw_token)
    expires_at = _now() + datetime.timedelta(days=INVITE_TTL_DAYS)
    invite = TournamentInvite(
        organization_id=org_id,
        tournament_id=tournament_id,
        email="",
        tournament_role=tournament_role.value,
        token_hash=token_hash,
        invited_by=actor_id,
        expires_at=expires_at,
    )
    session.add(invite)
    await session.flush()
    return raw_token, expires_at


async def revoke_invite(
    session: AsyncSession,
    *,
    tournament_id: uuid.UUID,
    invite_id: uuid.UUID,
) -> None:
    result = await session.get(TournamentInvite, invite_id)
    if result is None or str(result.tournament_id) != str(tournament_id):
        raise NotFoundError("invite not found")
    result.status = TournamentInviteStatus.REVOKED.value
    await session.flush()


async def resend_invite(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    tournament_id: uuid.UUID,
    invite_id: uuid.UUID,
    email_channel: Any,
    tournament_name: str,
) -> TournamentInvite:
    invite = await session.get(TournamentInvite, invite_id)
    if invite is None or str(invite.tournament_id) != str(tournament_id):
        raise NotFoundError("invite not found")
    if invite.status != TournamentInviteStatus.PENDING.value:
        raise ConflictError("invite is not pending")

    raw = new_opaque_token()
    invite.token_hash = hash_token(raw)
    invite.expires_at = _now() + datetime.timedelta(days=INVITE_TTL_DAYS)
    await session.flush()
    await email_channel.send(
        invite.email,
        "tournament_invite",
        {
            "token": raw,
            "tournament_name": tournament_name,
            "role": invite.tournament_role,
        },
    )
    return invite
