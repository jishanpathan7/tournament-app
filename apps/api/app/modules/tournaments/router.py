"""Tournament domain HTTP endpoints.

Tenant-scoped via ``get_request_session`` (RLS org context) + org-scoped repo queries;
authz via the pure policy (``tournament:create`` / ``tournament:update``). Divisions,
stages, and draws are addressable resources under their own paths.
"""

from __future__ import annotations

import csv
import io
import uuid

from fastapi import APIRouter, Depends, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    Principal,
    authed_csrf,
    get_principal,
    get_request_session,
    require_permission,
)
from app.cache import get_json
from app.cache import keys as cache_keys
from app.cache import set_json
from app.core import authz
from app.core.factory import get_cache
from app.core.ports import Cache
from app.db.models import Division, Stage, Tournament
from app.modules.registrations import repository as registrations_repo
from app.modules.scoring import repository as scoring_repo
from app.modules.tournaments import repository as repo
from app.modules.tournaments import service
from app.modules.tournaments.schemas import (
    ActivityEventView,
    AdvanceToKnockoutRequest,
    AdvanceToKnockoutResponse,
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
    UpdateDivisionRequest,
    UpdateStageConfigRequest,
    UpdateTournamentRequest,
)
from app.modules.venues.schemas import VenueResponse

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
        venue_name=(
            tournament.venue.name if tournament.venue else tournament.settings.get("venue_name")
        ),
        venue=(
            VenueResponse(
                id=tournament.venue.id,
                name=tournament.venue.name,
                address=tournament.venue.address,
                maps_url=tournament.venue.maps_url,
            )
            if tournament.venue
            else None
        ),
        draw_published_at=tournament.draw_published_at,
        schedule_published_at=tournament.schedule_published_at,
        results_published_at=tournament.results_published_at,
        created_at=tournament.created_at,
    )


def _build_tournament_response(tournament: Tournament, sport_key: str) -> TournamentResponse:
    """Sync variant for use when the sport key is already known (e.g. batch list)."""
    return TournamentResponse(
        id=tournament.id,
        slug=tournament.slug,
        name=tournament.name,
        sport_key=sport_key,
        status=tournament.status,
        visibility=tournament.visibility,
        starts_at=tournament.starts_at,
        ends_at=tournament.ends_at,
        settings=tournament.settings,
        venue_name=(
            tournament.venue.name if tournament.venue else tournament.settings.get("venue_name")
        ),
        venue=(
            VenueResponse(
                id=tournament.venue.id,
                name=tournament.venue.name,
                address=tournament.venue.address,
                maps_url=tournament.venue.maps_url,
            )
            if tournament.venue
            else None
        ),
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
    cache: Cache = Depends(get_cache),
) -> list[TournamentResponse]:
    rows = await repo.list_tournaments(session, principal.organization_id)
    profile_ids = list({t.sport_profile_id for t in rows if t.sport_profile_id})
    # Sport profiles are static at MVP — cache the id→key map for 1h.
    ckey = cache_keys.sport_profiles_key(principal.organization_id)
    cached_profile_keys: dict[str, str] | None = await get_json(cache, ckey)
    if cached_profile_keys is None:
        profiles = await repo.list_sport_profiles_by_ids(session, profile_ids)
        cached_profile_keys = {str(pid): p.key for pid, p in profiles.items()}
        await set_json(cache, ckey, cached_profile_keys, ttl=3600)
    return [
        _build_tournament_response(t, cached_profile_keys.get(str(t.sport_profile_id), ""))
        for t in rows
    ]


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
        auto_schedule=body.auto_schedule,
        pair_creation_mode=body.pair_creation_mode,
        match_duration_minutes=body.match_duration_minutes,
        venue_id=body.venue_id,
        clear_venue=body.clear_venue,
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


@router.get("/tournaments/{tournament_id}/stages", response_model=list[StageResponse])
async def list_tournament_stages(
    tournament_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> list[StageResponse]:
    await service._require_tournament(session, principal.organization_id, tournament_id)
    rows = await repo.list_tournament_stages(session, principal.organization_id, tournament_id)
    # Batch: 2 aggregate queries replace 2N per-stage queries.
    stats = await repo.stage_draw_stats(session, principal.organization_id, [s.id for s in rows])
    return [
        _stage_response(
            stage,
            drawn=stats.get(stage.id, (0, False))[0] > 0,
            locked=stats.get(stage.id, (0, False))[1],
        )
        for stage in rows
    ]


@router.get("/tournaments/{tournament_id}/divisions", response_model=list[DivisionResponse])
async def list_divisions(
    tournament_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> list[DivisionResponse]:
    rows = await repo.list_divisions(session, principal.organization_id, tournament_id)
    return [_division_response(d) for d in rows]


@router.patch(
    "/divisions/{division_id}",
    response_model=DivisionResponse,
    dependencies=[Depends(authed_csrf)],
)
async def update_division(
    division_id: uuid.UUID,
    body: UpdateDivisionRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> DivisionResponse:
    division = await service.update_division(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        division_id=division_id,
        name=body.name,
        participant_type=body.participant_type,
        capacity=body.capacity,
        clear_capacity=body.clear_capacity,
    )
    return _division_response(division)


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
    # Batch: 2 aggregate queries replace 2N per-stage queries.
    stats = await repo.stage_draw_stats(session, principal.organization_id, [s.id for s in rows])
    return [
        _stage_response(
            stage,
            drawn=stats.get(stage.id, (0, False))[0] > 0,
            locked=stats.get(stage.id, (0, False))[1],
        )
        for stage in rows
    ]


@router.patch(
    "/divisions/{division_id}/stages/{stage_id}/config",
    response_model=StageResponse,
    dependencies=[Depends(authed_csrf)],
)
async def update_stage_config(
    division_id: uuid.UUID,
    stage_id: uuid.UUID,
    body: UpdateStageConfigRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> StageResponse:
    stage = await service.update_stage_config(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        division_id=division_id,
        stage_id=stage_id,
        config=body.config,
    )
    locked = await repo.stage_has_scored_matches(session, principal.organization_id, stage.id)
    drawn = await repo.stage_match_count(session, principal.organization_id, stage.id) > 0
    return _stage_response(stage, drawn=drawn, locked=locked)


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


@router.post(
    "/stages/{stage_id}/advance",
    response_model=AdvanceToKnockoutResponse,
    status_code=201,
    dependencies=[Depends(authed_csrf)],
)
async def advance_to_knockout(
    stage_id: uuid.UUID,
    body: AdvanceToKnockoutRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> AdvanceToKnockoutResponse:
    ko_stage, summary = await service.advance_to_knockout(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        source_stage_id=stage_id,
        take=body.take,
        rng_seed=body.rng_seed,
    )
    return AdvanceToKnockoutResponse(
        stage_id=ko_stage.id,
        format=ko_stage.type,
        matches=summary["matches"],
        scheduled=summary["scheduled"],
        pending=summary["pending"],
    )


# ---- exports ----


def _csv_response(rows: list[list[str]], filename: str) -> StreamingResponse:
    buf = io.StringIO()
    csv.writer(buf).writerows(rows)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/tournaments/{tournament_id}/export/registrations.csv")
async def export_registrations(
    tournament_id: uuid.UUID,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> StreamingResponse:
    await service._require_tournament(session, principal.organization_id, tournament_id)
    regs = await registrations_repo.list_registrations_for_tournament(
        session, principal.organization_id, tournament_id
    )
    header = ["id", "status", "name", "email", "division_id", "submitted_at"]
    rows: list[list[str]] = [header]
    for r in regs:
        form = r.form_response or {}
        rows.append(
            [
                str(r.id),
                r.status,
                str(form.get("name", form.get("display_name", ""))),
                str(form.get("email", "")),
                str(r.division_id),
                r.created_at.isoformat() if r.created_at else "",
            ]
        )
    return _csv_response(rows, "registrations.csv")


@router.get("/tournaments/{tournament_id}/export/matches.csv")
async def export_matches(
    tournament_id: uuid.UUID,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> StreamingResponse:
    await service._require_tournament(session, principal.organization_id, tournament_id)
    matches = await scoring_repo.list_tournament_matches(
        session, principal.organization_id, tournament_id
    )
    header = ["match_id", "status", "round", "side_a", "side_b", "winner", "score", "scheduled_at"]
    rows: list[list[str]] = [header]
    for m in matches:
        sides = list(m.participants)
        side_a = sides[0].participant_id if len(sides) > 0 else ""
        side_b = sides[1].participant_id if len(sides) > 1 else ""
        winner_id = next((str(mp.participant_id) for mp in sides if mp.outcome == "win"), "")
        score = str(m.result_payload) if m.result_payload else ""
        rows.append(
            [
                str(m.id),
                m.status,
                (m.round.label or "") if m.round else "",
                str(side_a),
                str(side_b),
                winner_id,
                score,
                m.scheduled_at.isoformat() if m.scheduled_at else "",
            ]
        )
    return _csv_response(rows, "matches.csv")


@router.get("/tournaments/{tournament_id}/export/standings.csv")
async def export_standings(
    tournament_id: uuid.UUID,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> StreamingResponse:
    await service._require_tournament(session, principal.organization_id, tournament_id)
    divisions = await repo.list_divisions(session, principal.organization_id, tournament_id)
    header = ["stage_id", "participant_id", "rank", "played", "won", "drawn", "lost", "points"]
    rows: list[list[str]] = [header]
    for division in divisions:
        stages = await repo.list_stages(session, principal.organization_id, division.id)
        for stage in stages:
            standings = await scoring_repo.stage_standings(
                session, principal.organization_id, stage.id
            )
            for s in standings:
                rows.append(
                    [
                        str(stage.id),
                        str(s.participant_id),
                        str(s.rank) if s.rank is not None else "",
                        str(s.played),
                        str(s.won),
                        str(s.drawn),
                        str(s.lost),
                        str(s.points),
                    ]
                )
    return _csv_response(rows, "standings.csv")
