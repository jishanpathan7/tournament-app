"""Shared FastAPI dependencies — the DI surface every module composes from.

- ``get_current_user`` (re-exported from ``auth_context``) — org-optional principal.
- ``get_principal`` — requires an ACTIVE org (composes on ``get_current_user``); use
  for tenant routes. ``get_request_session`` opens one transaction with the org
  context set so RLS applies. Services NEVER commit — the boundary lives here.
- ``require_permission(action)`` — authz via the pure ``core.authz`` policy.
- ``csrf_protect`` — double-submit CSRF check for unsafe methods (attach per route).
- ``cursor_params`` (re-exported), ``idempotency_key`` header.
"""

from __future__ import annotations

import secrets
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass

from fastapi import Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth_context import CurrentUser, get_current_user
from app.api.errors import AuthenticationError, NotFoundError, PermissionDeniedError
from app.api.pagination import CursorParams, cursor_params
from app.core import authz
from app.core.config import get_settings
from app.core.db import get_session
from app.db.enums import OrgRole
from app.db.session import set_org_context

__all__ = [
    "Principal",
    "CurrentUser",
    "get_current_user",
    "get_principal",
    "require_permission",
    "require_flag",
    "get_request_session",
    "get_tx_session",
    "csrf_protect",
    "authed_csrf",
    "CursorParams",
    "cursor_params",
    "idempotency_key",
]

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "TRACE"})


@dataclass(frozen=True)
class Principal:
    """An authenticated caller WITH an active organization (tenant routes)."""

    user_id: uuid.UUID
    organization_id: uuid.UUID
    org_role: OrgRole


async def get_principal(current: CurrentUser = Depends(get_current_user)) -> Principal:
    """Require an active organization; org-less users hit this on tenant routes."""
    if current.organization_id is None or current.org_role is None:
        raise AuthenticationError("No active organization — create or switch to one.")
    return Principal(
        user_id=current.user_id,
        organization_id=current.organization_id,
        org_role=current.org_role,
    )


def require_permission(action: str) -> Callable[[Principal], Awaitable[Principal]]:
    """Route guard: enforce the policy for `action` (default-deny). No authz in routers."""

    async def _dependency(principal: Principal = Depends(get_principal)) -> Principal:
        if not authz.can(principal.org_role, action):
            raise PermissionDeniedError(f"Not permitted: {action}")
        return principal

    return _dependency


def require_flag(
    action_key: str, *, error: str = "Feature not available"
) -> Callable[[Principal, AsyncSession], Awaitable[Principal]]:
    """Route guard: 404 unless feature flag ``action_key`` is enabled for the caller.
    Reusable so modules gate on flags instead of hardcoded checks — evaluated with the
    user > org > global precedence + rollout of ``flags.service.is_enabled``."""

    async def _dependency(
        principal: Principal = Depends(get_principal),
        session: AsyncSession = Depends(get_session),
    ) -> Principal:
        from app.modules.flags import service as flags_service

        enabled = await flags_service.is_enabled(
            session, action_key, org_id=principal.organization_id, user_id=principal.user_id
        )
        if not enabled:
            raise NotFoundError(error)
        return principal

    return _dependency


async def get_request_session(
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
) -> AsyncIterator[AsyncSession]:
    """Request-scoped unit of work: one transaction with org context set for RLS.
    Commits on clean exit, rolls back on exception."""
    async with session.begin():
        await set_org_context(session, principal.organization_id)
        yield session


async def get_tx_session(
    session: AsyncSession = Depends(get_session),
) -> AsyncIterator[AsyncSession]:
    """Transactional session WITHOUT org context — for identity/system paths
    (login, register, password flows) that touch NO_RLS tables. Commits on success."""
    async with session.begin():
        yield session


async def csrf_protect(request: Request) -> None:
    """Double-submit CSRF check on unsafe methods + Origin allow-list. Attach via
    ``dependencies=[Depends(csrf_protect)]`` on authenticated mutating routes."""
    if request.method in SAFE_METHODS:
        return
    settings = get_settings()
    cookie = request.cookies.get(settings.csrf_cookie_name)
    header = request.headers.get("x-csrf-token")
    if not cookie or not header or not secrets.compare_digest(cookie, header):
        raise PermissionDeniedError("CSRF token missing or invalid", code="csrf_failed")
    origin = request.headers.get("origin")
    if origin is not None and origin not in set(settings.cors_origin_list):
        raise PermissionDeniedError("Disallowed origin", code="csrf_failed")


async def authed_csrf(request: Request, _current: CurrentUser = Depends(get_current_user)) -> None:
    """Auth-then-CSRF guard for authenticated mutations: resolve the user FIRST (401
    if unauthenticated) before the CSRF check (403), so an unauthenticated caller gets
    a truthful 401 rather than a misleading csrf_failed. (Refresh-cookie endpoints like
    logout use the plain csrf_protect instead.)"""
    await csrf_protect(request)


async def idempotency_key(
    value: str | None = Header(default=None, alias="Idempotency-Key"),
) -> str | None:
    """The ``Idempotency-Key`` header. Storage/replay lands with the first scoring module."""
    return value
