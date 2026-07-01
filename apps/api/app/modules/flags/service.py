"""Feature-flag evaluation + management.

``is_enabled`` resolves a flag for a subject with precedence user > org > global and a
deterministic, sticky percentage rollout (same subject always lands in the same
bucket). ``upsert``/``delete_flag`` back the management API. Never commits — the
dependency owns the transaction.
"""

from __future__ import annotations

import hashlib
import uuid
from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import NotFoundError
from app.db.enums import FeatureFlagScope
from app.db.models import FeatureFlag
from app.modules.flags import repository as repo


def _bucket(key: str, subject: uuid.UUID) -> int:
    digest = hashlib.sha256(f"{key}:{subject}".encode()).hexdigest()
    return int(digest, 16) % 100


def _evaluate(flag: FeatureFlag, *, subject: uuid.UUID | None) -> bool:
    if not flag.enabled:
        return False
    pct = flag.rollout_percentage
    if pct >= 100:
        return True
    if pct <= 0:
        return False
    if subject is None:  # nothing to bucket on → treat an enabled partial rollout as on
        return True
    return _bucket(flag.key, subject) < pct


async def is_enabled(
    session: AsyncSession,
    key: str,
    *,
    org_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    default: bool = False,
) -> bool:
    """Resolve a flag: user override, then org override, then global; else ``default``."""
    if user_id is not None:
        flag = await repo.get(session, key, FeatureFlagScope.USER, user_id)
        if flag is not None:
            return _evaluate(flag, subject=user_id)
    if org_id is not None:
        flag = await repo.get(session, key, FeatureFlagScope.ORGANIZATION, org_id)
        if flag is not None:
            return _evaluate(flag, subject=org_id)
    flag = await repo.get(session, key, FeatureFlagScope.GLOBAL, None)
    if flag is not None:
        return _evaluate(flag, subject=user_id or org_id)
    return default


async def upsert(
    session: AsyncSession,
    *,
    key: str,
    scope: FeatureFlagScope,
    scope_id: uuid.UUID | None,
    enabled: bool,
    rollout_percentage: int,
    description: str | None,
) -> FeatureFlag:
    flag = await repo.get(session, key, scope, scope_id)
    if flag is None:
        flag = FeatureFlag(
            key=key,
            scope=scope.value,
            scope_id=scope_id,
            enabled=enabled,
            rollout_percentage=rollout_percentage,
            description=description,
        )
        session.add(flag)
    else:
        flag.enabled = enabled
        flag.rollout_percentage = rollout_percentage
        flag.description = description
    await session.flush()
    return flag


async def list_org_and_global(session: AsyncSession, org_id: uuid.UUID) -> Sequence[FeatureFlag]:
    return await repo.list_org_and_global(session, org_id)


async def delete_org_flag(session: AsyncSession, *, flag_id: uuid.UUID, org_id: uuid.UUID) -> None:
    """Delete an organization-scoped flag owned by this org (global/user flags are
    not deletable via the org API)."""
    flag = await repo.get_by_id(session, flag_id)
    if flag is None or flag.scope != FeatureFlagScope.ORGANIZATION.value or flag.scope_id != org_id:
        raise NotFoundError("Feature flag not found")
    await session.delete(flag)
    await session.flush()
