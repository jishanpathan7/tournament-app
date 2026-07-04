"""Data access for revocable share links (match scorekeeper)."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import ShareLinkScope
from app.db.models import ShareLink


async def get_by_token_hash(session: AsyncSession, token_hash: str) -> ShareLink | None:
    stmt = select(ShareLink).where(ShareLink.token_hash == token_hash)
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_active_match_scorekeeper_link(
    session: AsyncSession, org_id: uuid.UUID, match_id: uuid.UUID
) -> ShareLink | None:
    stmt = (
        select(ShareLink)
        .where(
            ShareLink.organization_id == org_id,
            ShareLink.match_id == match_id,
            ShareLink.scope == ShareLinkScope.SCOREKEEPER.value,
            ShareLink.revoked.is_(False),
        )
        .order_by(ShareLink.created_at.desc())
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_match_scorekeeper_links(
    session: AsyncSession, org_id: uuid.UUID, match_id: uuid.UUID
) -> Sequence[ShareLink]:
    stmt = (
        select(ShareLink)
        .where(
            ShareLink.organization_id == org_id,
            ShareLink.match_id == match_id,
            ShareLink.scope == ShareLinkScope.SCOREKEEPER.value,
        )
        .order_by(ShareLink.created_at.desc())
    )
    return (await session.execute(stmt)).scalars().all()


async def get_active_division_checkin_link(
    session: AsyncSession, org_id: uuid.UUID, division_id: uuid.UUID
) -> ShareLink | None:
    stmt = (
        select(ShareLink)
        .where(
            ShareLink.organization_id == org_id,
            ShareLink.division_id == division_id,
            ShareLink.scope == ShareLinkScope.CHECK_IN.value,
            ShareLink.revoked.is_(False),
        )
        .order_by(ShareLink.created_at.desc())
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_division_checkin_links(
    session: AsyncSession, org_id: uuid.UUID, division_id: uuid.UUID
) -> Sequence[ShareLink]:
    stmt = (
        select(ShareLink)
        .where(
            ShareLink.organization_id == org_id,
            ShareLink.division_id == division_id,
            ShareLink.scope == ShareLinkScope.CHECK_IN.value,
        )
        .order_by(ShareLink.created_at.desc())
    )
    return (await session.execute(stmt)).scalars().all()
