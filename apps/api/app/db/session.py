"""Per-transaction org context for Postgres Row-Level Security.

RLS policies read the ``app.current_org`` GUC via ``current_setting()``. The auth
layer (not built yet) will resolve the request's org and call ``set_org_context``
on the request-scoped session — see ``app/core/db.py:get_session``.

CONTRACT: ``set_config(..., is_local=true)`` only persists within an explicit
transaction. Call these inside ``async with session.begin():`` (or use ``org_scope``).

GOTCHAS (see app/db/rls.py): tenant tables are FORCE'd, so with no org context a
tenant query returns ZERO rows (not an error). Superuser / BYPASSRLS roles bypass
RLS entirely regardless of FORCE — the app must connect as a non-superuser role
in production for isolation to apply.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def set_org_context(session: AsyncSession, org_id: uuid.UUID | str) -> None:
    """SET LOCAL app.current_org = <org_id> for the current transaction."""
    await session.execute(
        text("SELECT set_config('app.current_org', :org, true)"),
        {"org": str(org_id)},
    )


async def clear_org_context(session: AsyncSession) -> None:
    """Reset app.current_org for the current transaction (tenant queries -> 0 rows)."""
    await session.execute(text("SELECT set_config('app.current_org', '', true)"))


@asynccontextmanager
async def org_scope(session: AsyncSession, org_id: uuid.UUID | str) -> AsyncIterator[AsyncSession]:
    """Open a transaction with org context set, for workers/tests."""
    async with session.begin():
        await set_org_context(session, org_id)
        yield session
