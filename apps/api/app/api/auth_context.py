"""Decode the access cookie into the request's authenticated user.

API-layer (reads the FastAPI ``Request``, raises ``AuthenticationError``). This is
the org-OPTIONAL principal — a user may be authenticated without an active org
(0-org accounts, the create/switch-org flow). ``app/api/deps.py:get_principal``
composes on this to require an active org for tenant routes.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from fastapi import Request

from app.api.errors import AuthenticationError
from app.core.config import get_settings
from app.core.context import set_principal_context
from app.core.security import TokenError, decode_access
from app.db.enums import OrgRole


@dataclass(frozen=True)
class CurrentUser:
    user_id: uuid.UUID
    session_id: uuid.UUID
    organization_id: uuid.UUID | None
    org_role: OrgRole | None
    remember: bool = False


async def get_current_user(request: Request) -> CurrentUser:
    settings = get_settings()
    token = request.cookies.get(settings.access_cookie_name)
    if not token:
        raise AuthenticationError("Not authenticated")
    try:
        claims = decode_access(token, settings=settings)
    except TokenError as exc:
        raise AuthenticationError("Invalid or expired session") from exc

    role = OrgRole(claims.org_role) if claims.org_role else None
    # Bind to the logging/error context for the rest of the request.
    set_principal_context(claims.user_id, claims.organization_id)
    return CurrentUser(
        user_id=claims.user_id,
        session_id=claims.session_id,
        organization_id=claims.organization_id,
        org_role=role,
        remember=claims.remember,
    )
