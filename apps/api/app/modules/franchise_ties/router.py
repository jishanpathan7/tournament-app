"""Franchise team-vs-team tie endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    Principal,
    authed_csrf,
    get_principal,
    get_request_session,
    require_permission,
)
from app.core import authz
from app.modules.franchise_ties import service
from app.modules.franchise_ties.schemas import (
    FranchiseDrawRequest,
    FranchiseDrawResponse,
    FranchiseKnockoutDrawRequest,
    FranchiseTiesBoardView,
)

router = APIRouter(tags=["franchise-ties"])

_manage = require_permission(authz.TOURNAMENT_UPDATE)


@router.post(
    "/stages/{stage_id}/franchise-draw",
    response_model=FranchiseDrawResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(authed_csrf)],
)
async def generate_franchise_draw(
    stage_id: uuid.UUID,
    body: FranchiseDrawRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> FranchiseDrawResponse:
    return await service.generate_franchise_draw(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        stage_id=stage_id,
        games_per_tie=body.games_per_tie,
    )


@router.post(
    "/stages/{stage_id}/franchise-knockout-draw",
    response_model=FranchiseDrawResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(authed_csrf)],
)
async def generate_franchise_knockout_draw(
    stage_id: uuid.UUID,
    body: FranchiseKnockoutDrawRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> FranchiseDrawResponse:
    return await service.generate_franchise_knockout_draw(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        stage_id=stage_id,
        source_stage_id=body.source_stage_id,
        advance_count=body.advance_count,
        games_per_tie=body.games_per_tie,
    )


@router.get(
    "/stages/{stage_id}/franchise-ties",
    response_model=FranchiseTiesBoardView,
)
async def get_franchise_ties_board(
    stage_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> FranchiseTiesBoardView:
    return await service.get_ties_board(
        session, org_id=principal.organization_id, stage_id=stage_id
    )
