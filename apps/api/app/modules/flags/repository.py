"""Data access for feature flags (NO_RLS config table — scoped explicitly by args)."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import FeatureFlagScope
from app.db.models import FeatureFlag


async def get(
    session: AsyncSession, key: str, scope: FeatureFlagScope, scope_id: uuid.UUID | None
) -> FeatureFlag | None:
    stmt = select(FeatureFlag).where(FeatureFlag.key == key, FeatureFlag.scope == scope.value)
    stmt = stmt.where(
        FeatureFlag.scope_id.is_(None) if scope_id is None else FeatureFlag.scope_id == scope_id
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_by_id(session: AsyncSession, flag_id: uuid.UUID) -> FeatureFlag | None:
    return await session.get(FeatureFlag, flag_id)


async def list_org_and_global(session: AsyncSession, org_id: uuid.UUID) -> Sequence[FeatureFlag]:
    """Org-scoped flags for this org plus global flags (read-only view of globals)."""
    stmt = (
        select(FeatureFlag)
        .where(
            (FeatureFlag.scope == FeatureFlagScope.GLOBAL.value)
            | (
                (FeatureFlag.scope == FeatureFlagScope.ORGANIZATION.value)
                & (FeatureFlag.scope_id == org_id)
            )
        )
        .order_by(FeatureFlag.key, FeatureFlag.scope)
    )
    return (await session.execute(stmt)).scalars().all()
