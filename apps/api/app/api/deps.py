"""Shared FastAPI dependencies — the DI surface every module composes from.

- ``get_principal`` / ``require_permission`` — auth/authz SEAMS. Bodies land with
  the auth module; defining the types/names now means future routers and the
  transaction dependency never get rewired.
- ``get_request_session`` — the request-scoped unit of work: ONE transaction with
  the org context set, so Postgres RLS applies. Use for ANY handler touching
  tenant data. Use the bare ``app.core.db.get_session`` only for system/identity
  paths (login, health, the outbox poller) that run outside an org context.
- ``cursor_params`` (re-exported), ``idempotency_key`` header.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.pagination import CursorParams, cursor_params
from app.core.db import get_session
from app.db.enums import OrgRole
from app.db.session import set_org_context

__all__ = [
    "Principal",
    "get_principal",
    "require_permission",
    "get_request_session",
    "CursorParams",
    "cursor_params",
    "idempotency_key",
]


@dataclass(frozen=True)
class Principal:
    """The authenticated caller. Grants/assignments are added with the auth module."""

    user_id: uuid.UUID
    organization_id: uuid.UUID
    org_role: OrgRole


async def get_principal() -> Principal:
    """Resolve the authenticated principal. Implemented by the auth module.

    Raises until then — no endpoint depends on it yet; tests override it via
    ``app.dependency_overrides``.
    """
    raise NotImplementedError("Authentication is not wired yet (auth module pending).")


def require_permission(action: str) -> Callable[[Principal], Awaitable[Principal]]:
    """Authz seam (default-deny). The policy ``can(principal, action, resource)``
    lands with auth; for now it only enforces an authenticated principal.
    """

    async def _dependency(principal: Principal = Depends(get_principal)) -> Principal:
        # TODO(auth): enforce can(principal, action, resource) — default-deny.
        return principal

    return _dependency


async def get_request_session(
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
) -> AsyncIterator[AsyncSession]:
    """Request-scoped unit of work: one transaction with org context set for RLS.

    Commits on clean exit, rolls back on exception (via ``session.begin()``).
    Services must NOT commit themselves — the boundary lives here.
    """
    async with session.begin():
        await set_org_context(session, principal.organization_id)
        yield session


async def idempotency_key(
    value: str | None = Header(default=None, alias="Idempotency-Key"),
) -> str | None:
    """The ``Idempotency-Key`` header. The contract is fixed now; storage/replay
    against ``idempotency_keys`` lands with the first mutating (scoring) module."""
    return value
