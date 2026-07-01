"""Organization use cases. Raises AppError; NEVER commits. Org-scoped security
events are written to ``audit_logs`` (org context must be set — by
``get_request_session`` for active-org routes, or explicitly here for the
genesis/accept paths that run without a pre-set context)."""

from __future__ import annotations

import datetime
import logging
import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ConflictError, NotFoundError, PermissionDeniedError, ValidationError
from app.core import audit
from app.core.security import hash_token, new_opaque_token
from app.db.enums import OrgInviteStatus, OrgRole
from app.db.models import Membership, Organization, OrgInvite
from app.db.session import set_org_context
from app.modules.orgs import events
from app.modules.orgs import repository as repo

logger = logging.getLogger("app.orgs")

INVITE_TTL_DAYS = 7


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


async def _audit(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID | None,
    action: str,
    entity: str,
    entity_id: uuid.UUID,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
) -> None:
    audit.record(
        session,
        organization_id=org_id,
        actor_id=actor_id,
        action=action,
        entity=entity,
        entity_id=entity_id,
        before=before,
        after=after,
    )


async def create_org(
    session: AsyncSession, *, user_id: uuid.UUID, name: str, slug: str
) -> tuple[Organization, Membership]:
    if await repo.get_org_by_slug(session, slug) is not None:
        raise ConflictError("That organization slug is taken")
    org = Organization(slug=slug, name=name)
    session.add(org)
    await session.flush()
    membership = Membership(organization_id=org.id, user_id=user_id, org_role=OrgRole.OWNER)
    session.add(membership)
    await set_org_context(session, org.id)  # genesis path has no pre-set context
    await _audit(
        session,
        org_id=org.id,
        actor_id=user_id,
        action=events.ORG_CREATED,
        entity="organization",
        entity_id=org.id,
        after={"slug": slug, "name": name},
    )
    logger.info("orgs.created", extra={"org_id": str(org.id)})
    return org, membership


async def switch_org(session: AsyncSession, *, user_id: uuid.UUID, org_id: uuid.UUID) -> Membership:
    membership = await repo.get_membership(session, user_id, org_id)
    if membership is None:
        raise PermissionDeniedError("You are not a member of that organization")
    return membership


async def update_org(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    name: str | None = None,
    timezone: str | None = None,
    branding: dict[str, Any] | None = None,
) -> Organization:
    org = await repo.get_org(session, org_id)
    if org is None:
        raise NotFoundError("Organization not found")
    before = {"name": org.name, "timezone": org.timezone}
    if name is not None:
        org.name = name
    if timezone is not None:
        org.timezone = timezone
    if branding is not None:
        org.branding = branding
    await _audit(
        session,
        org_id=org_id,
        actor_id=actor_id,
        action=events.ORG_UPDATED,
        entity="organization",
        entity_id=org_id,
        before=before,
        after={"name": org.name, "timezone": org.timezone},
    )
    return org


async def list_members(session: AsyncSession, *, org_id: uuid.UUID) -> Sequence[Membership]:
    return await repo.list_members(session, org_id)


async def change_member_role(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    target_user_id: uuid.UUID,
    new_role: OrgRole,
) -> Membership:
    membership = await repo.get_membership(session, target_user_id, org_id)
    if membership is None:
        raise NotFoundError("Member not found")
    old_role = OrgRole(membership.org_role)
    if (
        old_role == OrgRole.OWNER
        and new_role != OrgRole.OWNER
        and await repo.count_owners(session, org_id) <= 1
    ):
        raise ConflictError("Cannot demote the last owner")
    membership.org_role = new_role
    await _audit(
        session,
        org_id=org_id,
        actor_id=actor_id,
        action=events.MEMBER_ROLE_CHANGED,
        entity="membership",
        entity_id=membership.id,
        before={"userId": str(target_user_id), "role": old_role.value},
        after={"role": new_role.value},
    )
    return membership


async def remove_member(
    session: AsyncSession, *, org_id: uuid.UUID, actor_id: uuid.UUID, target_user_id: uuid.UUID
) -> None:
    membership = await repo.get_membership(session, target_user_id, org_id)
    if membership is None:
        raise NotFoundError("Member not found")
    if (
        OrgRole(membership.org_role) == OrgRole.OWNER
        and await repo.count_owners(session, org_id) <= 1
    ):
        raise ConflictError("Cannot remove the last owner")
    await _audit(
        session,
        org_id=org_id,
        actor_id=actor_id,
        action=events.MEMBER_REMOVED,
        entity="membership",
        entity_id=membership.id,
        before={"userId": str(target_user_id), "role": OrgRole(membership.org_role).value},
    )
    await session.delete(membership)


async def create_invite(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    email: str,
    role: OrgRole,
    email_channel: Any,
) -> tuple[OrgInvite, str]:
    raw = new_opaque_token()
    invite = OrgInvite(
        organization_id=org_id,
        email=email,
        org_role=role,
        token_hash=hash_token(raw),
        invited_by=actor_id,
        expires_at=_now() + datetime.timedelta(days=INVITE_TTL_DAYS),
    )
    session.add(invite)
    await session.flush()
    await _audit(
        session,
        org_id=org_id,
        actor_id=actor_id,
        action=events.INVITE_CREATED,
        entity="org_invite",
        entity_id=invite.id,
        after={"email": email, "role": role.value},
    )
    await email_channel.send(email, "org_invite", {"token": raw, "organizationId": str(org_id)})
    return invite, raw


async def list_invites(session: AsyncSession, *, org_id: uuid.UUID) -> Sequence[OrgInvite]:
    return await repo.list_invites(session, org_id)


async def revoke_invite(
    session: AsyncSession, *, org_id: uuid.UUID, actor_id: uuid.UUID, invite_id: uuid.UUID
) -> None:
    invite = await repo.get_invite(session, org_id, invite_id)
    if invite is None:
        raise NotFoundError("Invite not found")
    invite.status = OrgInviteStatus.REVOKED
    await _audit(
        session,
        org_id=org_id,
        actor_id=actor_id,
        action=events.INVITE_REVOKED,
        entity="org_invite",
        entity_id=invite.id,
    )


async def accept_invite(
    session: AsyncSession, *, user_id: uuid.UUID, raw_token: str
) -> tuple[Organization, Membership]:
    invite = await repo.get_invite_by_token(session, hash_token(raw_token))
    if invite is None or invite.status != OrgInviteStatus.PENDING or invite.expires_at < _now():
        raise ValidationError("Invalid or expired invite")
    membership = await repo.get_membership(session, user_id, invite.organization_id)
    if membership is None:
        membership = Membership(
            organization_id=invite.organization_id,
            user_id=user_id,
            org_role=OrgRole(invite.org_role),
        )
        session.add(membership)
        await session.flush()
    invite.status = OrgInviteStatus.ACCEPTED
    invite.accepted_at = _now()
    invite.accepted_user_id = user_id
    org = await repo.get_org(session, invite.organization_id)
    if org is None:  # pragma: no cover - FK guarantees it exists
        raise NotFoundError("Organization not found")
    await set_org_context(session, invite.organization_id)  # accept path has no pre-set context
    await _audit(
        session,
        org_id=invite.organization_id,
        actor_id=user_id,
        action=events.INVITE_ACCEPTED,
        entity="membership",
        entity_id=membership.id,
        after={"userId": str(user_id), "role": OrgRole(invite.org_role).value},
    )
    return org, membership
