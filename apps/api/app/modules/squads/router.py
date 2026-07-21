"""Franchise squad HTTP endpoints — tournament-level team assignment before pairing."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    Principal,
    authed_csrf,
    get_principal,
    get_request_session,
    require_permission,
)
from app.core import authz
from app.modules.squads import service
from app.modules.squads.schemas import (
    AssignMemberRequest,
    AutoDistributeRequest,
    AutoDistributeResponse,
    CreateSquadRequest,
    SquadView,
    SwapMembersRequest,
    TournamentSquadsView,
    UpdateSquadRequest,
)

router = APIRouter(tags=["squads"])

_manage = require_permission(authz.TOURNAMENT_UPDATE)


@router.get("/tournaments/{tournament_id}/squads", response_model=TournamentSquadsView)
async def get_squads(
    tournament_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> TournamentSquadsView:
    return await service.get_board(session, principal.organization_id, tournament_id)


@router.post(
    "/tournaments/{tournament_id}/squads",
    response_model=SquadView,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(authed_csrf)],
)
async def create_squad(
    tournament_id: uuid.UUID,
    body: CreateSquadRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> SquadView:
    return await service.create_squad(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        tournament_id=tournament_id,
        name=body.name,
    )


@router.post(
    "/tournaments/{tournament_id}/squads/auto-distribute",
    response_model=AutoDistributeResponse,
    dependencies=[Depends(authed_csrf)],
)
async def auto_distribute(
    tournament_id: uuid.UUID,
    body: AutoDistributeRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> AutoDistributeResponse:
    return await service.auto_distribute(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        tournament_id=tournament_id,
        team_count=body.team_count,
        division_id=body.division_id,
        replace_existing=body.replace_existing,
    )


@router.post(
    "/tournaments/{tournament_id}/squads/swap-members",
    response_model=TournamentSquadsView,
    dependencies=[Depends(authed_csrf)],
)
async def swap_members(
    tournament_id: uuid.UUID,
    body: SwapMembersRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> TournamentSquadsView:
    """Atomically trade one member between two squads (both move or neither does)."""
    return await service.swap_members(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        tournament_id=tournament_id,
        squad_a_id=body.squad_a_id,
        registration_a_id=body.registration_a_id,
        squad_b_id=body.squad_b_id,
        registration_b_id=body.registration_b_id,
    )


@router.patch(
    "/squads/{squad_id}",
    response_model=SquadView,
    dependencies=[Depends(authed_csrf)],
)
async def update_squad(
    squad_id: uuid.UUID,
    body: UpdateSquadRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> SquadView:
    return await service.update_squad(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        squad_id=squad_id,
        name=body.name,
        captain_registration_id=body.captain_registration_id,
        clear_captain=body.clear_captain,
    )


@router.delete(
    "/squads/{squad_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(authed_csrf)],
)
async def delete_squad(
    squad_id: uuid.UUID,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> Response:
    await service.delete_squad(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        squad_id=squad_id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/squads/{squad_id}/members",
    response_model=SquadView,
    dependencies=[Depends(authed_csrf)],
)
async def assign_member(
    squad_id: uuid.UUID,
    body: AssignMemberRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> SquadView:
    return await service.assign_member(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        squad_id=squad_id,
        registration_id=body.registration_id,
    )


@router.delete(
    "/squads/{squad_id}/members/{registration_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(authed_csrf)],
)
async def remove_member(
    squad_id: uuid.UUID,
    registration_id: uuid.UUID,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> Response:
    await service.remove_member(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        squad_id=squad_id,
        registration_id=registration_id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
