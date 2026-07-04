"""Tournament domain HTTP endpoints.

Tenant-scoped via ``get_request_session`` (RLS org context) + org-scoped repo queries;
authz via the pure policy (``tournament:create`` / ``tournament:update``). Divisions,
stages, and draws are addressable resources under their own paths.
"""

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
from app.db.models import Division, Stage, Tournament
from app.modules.tournaments import repository as repo
from app.modules.tournaments import service
from app.modules.tournaments.schemas import (
    ActivityEventView,
    CreateDivisionRequest,
    CreateStageRequest,
    CreateTournamentRequest,
    DivisionResponse,
    DrawRequest,
    DrawResponse,
    PublishRequest,
    StageResponse,
    StatusTransitionRequest,
    TournamentResponse,
    UpdateTournamentRequest,
)

router = APIRouter(tags=["tournaments"])

_manage = require_permission(authz.TOURNAMENT_UPDATE)
_create = require_permission(authz.TOURNAMENT_CREATE)
_delete = require_permission(authz.TOURNAMENT_DELETE)


async def _tournament_response(session: AsyncSession, tournament: Tournament) -> TournamentResponse:
    profile = await repo.get_sport_profile(session, tournament.sport_profile_id)
    return TournamentResponse(
        id=tournament.id,
        slug=tournament.slug,
        name=tournament.name,
        sport_key=profile.key if profile else "",
        status=tournament.status,
        visibility=tournament.visibility,
        starts_at=tournament.starts_at,
        ends_at=tournament.ends_at,
        settings=tournament.settings,
        draw_published_at=tournament.draw_published_at,
        schedule_published_at=tournament.schedule_published_at,
        results_published_at=tournament.results_published_at,
        created_at=tournament.created_at,
    )


def _division_response(division: Division) -> DivisionResponse:
    return DivisionResponse(
        id=division.id,
        tournament_id=division.tournament_id,
        name=division.name,
        participant_type=division.participant_type,
        capacity=division.capacity,
        reg_form=division.reg_form,
        created_at=division.created_at,
    )


def _stage_response(stage: Stage, *, drawn: bool, locked: bool) -> StageResponse:
    return StageResponse(
        id=stage.id,
        division_id=stage.division_id,
        type=stage.type,
        seq=stage.seq,
        config=stage.config,
        advances_n=stage.advances_n,
        drawn=drawn,
        locked=locked,
        created_at=stage.created_at,
    )


# ---- tournament ----


@router.post(
    "/tournaments",
    response_model=TournamentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(authed_csrf)],
)
async def create_tournament(
    body: CreateTournamentRequest,
    principal: Principal = Depends(_create),
    session: AsyncSession = Depends(get_request_session),
) -> TournamentResponse:
    tournament = await service.create_tournament(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        name=body.name,
        slug=body.slug,
        sport_key=body.sport_key,
        visibility=body.visibility,
    )
    return await _tournament_response(session, tournament)


@router.get("/tournaments", response_model=list[TournamentResponse])
async def list_tournaments(
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> list[TournamentResponse]:
    rows = await repo.list_tournaments(session, principal.organization_id)
    return [await _tournament_response(session, t) for t in rows]


@router.get("/tournaments/{tournament_id}", response_model=TournamentResponse)
async def get_tournament(
    tournament_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> TournamentResponse:
    tournament = await service._require_tournament(
        session, principal.organization_id, tournament_id
    )
    return await _tournament_response(session, tournament)


@router.get("/tournaments/{tournament_id}/activity", response_model=list[ActivityEventView])
async def get_tournament_activity(
    tournament_id: uuid.UUID,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> list[ActivityEventView]:
    await service._require_tournament(session, principal.organization_id, tournament_id)
    rows = await repo.tournament_activity(session, principal.organization_id, tournament_id)
    return [
        ActivityEventView(
            id=e.id,
            action=e.action,
            entity=e.entity,
            entity_id=e.entity_id,
            actor_id=e.actor_id,
            before=e.before,
            after=e.after,
            created_at=e.created_at,
        )
        for e in rows
    ]


@router.patch(
    "/tournaments/{tournament_id}",
    response_model=TournamentResponse,
    dependencies=[Depends(authed_csrf)],
)
async def update_tournament(
    tournament_id: uuid.UUID,
    body: UpdateTournamentRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> TournamentResponse:
    tournament = await service.update_tournament(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        tournament_id=tournament_id,
        name=body.name,
        visibility=body.visibility,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
        settings=body.settings,
    )
    return await _tournament_response(session, tournament)


@router.delete(
    "/tournaments/{tournament_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(authed_csrf)],
)
async def delete_tournament(
    tournament_id: uuid.UUID,
    principal: Principal = Depends(_delete),
    session: AsyncSession = Depends(get_request_session),
) -> Response:
    await service.delete_tournament(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        tournament_id=tournament_id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/tournaments/{tournament_id}/status",
    response_model=TournamentResponse,
    dependencies=[Depends(authed_csrf)],
)
async def transition_status(
    tournament_id: uuid.UUID,
    body: StatusTransitionRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> TournamentResponse:
    tournament = await service.transition_status(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        tournament_id=tournament_id,
        new_status=body.status,
    )
    return await _tournament_response(session, tournament)


@router.post(
    "/tournaments/{tournament_id}/publish",
    response_model=TournamentResponse,
    dependencies=[Depends(authed_csrf)],
)
async def publish_tournament(
    tournament_id: uuid.UUID,
    body: PublishRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> TournamentResponse:
    tournament = await service.publish(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        tournament_id=tournament_id,
        artifacts=body.artifacts,
    )
    return await _tournament_response(session, tournament)


# ---- divisions ----


@router.post(
    "/tournaments/{tournament_id}/divisions",
    response_model=DivisionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(authed_csrf)],
)
async def create_division(
    tournament_id: uuid.UUID,
    body: CreateDivisionRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> DivisionResponse:
    division = await service.create_division(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        tournament_id=tournament_id,
        name=body.name,
        participant_type=body.participant_type,
        capacity=body.capacity,
        reg_form=body.reg_form,
    )
    return _division_response(division)


@router.get("/tournaments/{tournament_id}/divisions", response_model=list[DivisionResponse])
async def list_divisions(
    tournament_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> list[DivisionResponse]:
    rows = await repo.list_divisions(session, principal.organization_id, tournament_id)
    return [_division_response(d) for d in rows]


# ---- stages ----


@router.post(
    "/divisions/{division_id}/stages",
    response_model=StageResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(authed_csrf)],
)
async def create_stage(
    division_id: uuid.UUID,
    body: CreateStageRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> StageResponse:
    stage = await service.create_stage(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        division_id=division_id,
        stage_format=body.type.value,
        seq=body.seq,
        config=body.config,
        points_rule_id=body.points_rule_id,
        tiebreak_ruleset_id=body.tiebreak_ruleset_id,
        advances_n=body.advances_n,
    )
    return _stage_response(stage, drawn=False, locked=False)


@router.get("/divisions/{division_id}/stages", response_model=list[StageResponse])
async def list_stages(
    division_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> list[StageResponse]:
    rows = await repo.list_stages(session, principal.organization_id, division_id)
    result = []
    for stage in rows:
        count = await repo.stage_match_count(session, principal.organization_id, stage.id)
        locked = count > 0 and await repo.stage_has_scored_matches(
            session, principal.organization_id, stage.id
        )
        result.append(_stage_response(stage, drawn=count > 0, locked=locked))
    return result


@router.post(
    "/stages/{stage_id}/draw",
    response_model=DrawResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(authed_csrf)],
)
async def generate_draw(
    stage_id: uuid.UUID,
    body: DrawRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> DrawResponse:
    _stage, summary = await service.generate_draw(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        stage_id=stage_id,
        rng_seed=body.rng_seed,
        override_readiness=body.override_readiness,
    )
    return DrawResponse(stage_id=stage_id, **summary)


@router.delete(
    "/stages/{stage_id}/draw",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(authed_csrf)],
)
async def clear_draw(
    stage_id: uuid.UUID,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> None:
    await service.clear_draw(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        stage_id=stage_id,
    )
