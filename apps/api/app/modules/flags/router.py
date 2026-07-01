"""Feature-flag endpoints.

Management is org-scoped: owners/admins (``feature_flag:manage``) upsert/list/delete
flags for their active org; global flags are shown read-only and managed out-of-band.
``GET /{key}/enabled`` resolves a flag for the current caller (user > org > global +
rollout) — any authenticated member can call it (e.g. to gate UI). The evaluator
(``service.is_enabled`` / ``deps.require_flag``) is what other modules use internally.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Principal, authed_csrf, get_principal, get_tx_session, require_permission
from app.core import authz
from app.core.db import get_session
from app.db.enums import FeatureFlagScope
from app.db.models import FeatureFlag
from app.modules.flags import service
from app.modules.flags.schemas import (
    FeatureFlagResource,
    FlagEnabledResponse,
    UpsertFeatureFlagRequest,
)

router = APIRouter(prefix="/feature-flags", tags=["feature-flags"])


def _resource(flag: FeatureFlag) -> FeatureFlagResource:
    return FeatureFlagResource(
        id=flag.id,
        key=flag.key,
        scope=flag.scope,
        scope_id=flag.scope_id,
        enabled=flag.enabled,
        rollout_percentage=flag.rollout_percentage,
        description=flag.description,
        created_at=flag.created_at,
    )


@router.get("", response_model=list[FeatureFlagResource])
async def list_flags(
    principal: Principal = Depends(require_permission(authz.FEATURE_FLAG_MANAGE)),
    session: AsyncSession = Depends(get_session),
) -> list[FeatureFlagResource]:
    flags = await service.list_org_and_global(session, principal.organization_id)
    return [_resource(f) for f in flags]


@router.put(
    "",
    response_model=FeatureFlagResource,
    dependencies=[Depends(authed_csrf)],
)
async def upsert_flag(
    body: UpsertFeatureFlagRequest,
    principal: Principal = Depends(require_permission(authz.FEATURE_FLAG_MANAGE)),
    session: AsyncSession = Depends(get_tx_session),
) -> FeatureFlagResource:
    flag = await service.upsert(
        session,
        key=body.key,
        scope=FeatureFlagScope.ORGANIZATION,
        scope_id=principal.organization_id,
        enabled=body.enabled,
        rollout_percentage=body.rollout_percentage,
        description=body.description,
    )
    return _resource(flag)


@router.delete(
    "/{flag_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(authed_csrf)],
)
async def delete_flag(
    flag_id: uuid.UUID,
    principal: Principal = Depends(require_permission(authz.FEATURE_FLAG_MANAGE)),
    session: AsyncSession = Depends(get_tx_session),
) -> Response:
    await service.delete_org_flag(session, flag_id=flag_id, org_id=principal.organization_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{key}/enabled", response_model=FlagEnabledResponse)
async def flag_enabled(
    key: str,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
) -> FlagEnabledResponse:
    enabled = await service.is_enabled(
        session, key, org_id=principal.organization_id, user_id=principal.user_id
    )
    return FlagEnabledResponse(key=key, enabled=enabled)
