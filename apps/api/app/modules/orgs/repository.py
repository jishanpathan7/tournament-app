"""Data access for the orgs module (organizations / memberships / org_invites).

These are NO_RLS identity tables — scoped explicitly by organization_id at the app
layer. ``audit_logs`` writes (in the service) DO rely on the request's org context."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.enums import OrgInviteStatus, OrgRole
from app.db.models import Membership, Organization, OrgInvite


async def get_org(session: AsyncSession, org_id: uuid.UUID) -> Organization | None:
    return await session.get(Organization, org_id)


async def get_org_by_slug(session: AsyncSession, slug: str) -> Organization | None:
    stmt = select(Organization).where(Organization.slug == slug)
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_membership(
    session: AsyncSession, user_id: uuid.UUID, org_id: uuid.UUID
) -> Membership | None:
    stmt = select(Membership).where(
        Membership.user_id == user_id, Membership.organization_id == org_id
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_members(session: AsyncSession, org_id: uuid.UUID) -> Sequence[Membership]:
    stmt = (
        select(Membership)
        .where(Membership.organization_id == org_id)
        .options(selectinload(Membership.user))
        .order_by(Membership.created_at)
    )
    return (await session.execute(stmt)).scalars().all()


async def count_owners(session: AsyncSession, org_id: uuid.UUID) -> int:
    stmt = select(func.count()).where(
        Membership.organization_id == org_id, Membership.org_role == OrgRole.OWNER
    )
    return int((await session.execute(stmt)).scalar_one())


async def get_invite_by_token(session: AsyncSession, token_hash: str) -> OrgInvite | None:
    stmt = select(OrgInvite).where(OrgInvite.token_hash == token_hash)
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_invite(
    session: AsyncSession, org_id: uuid.UUID, invite_id: uuid.UUID
) -> OrgInvite | None:
    stmt = select(OrgInvite).where(OrgInvite.id == invite_id, OrgInvite.organization_id == org_id)
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_invites(session: AsyncSession, org_id: uuid.UUID) -> Sequence[OrgInvite]:
    stmt = (
        select(OrgInvite)
        .where(OrgInvite.organization_id == org_id, OrgInvite.status == OrgInviteStatus.PENDING)
        .order_by(OrgInvite.created_at.desc())
    )
    return (await session.execute(stmt)).scalars().all()
