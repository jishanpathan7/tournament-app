"""Scoring HTTP endpoints — submit/correct a match score, read a match, read standings.

Score submission is guarded by ``scoring:write`` + CSRF, supports optimistic concurrency
via the ``If-Match`` header (ETag) and replay-safety via ``Idempotency-Key``. Reads are
org-scoped (RLS + repo). The ETag is returned on every match view.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Header, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    Principal,
    authed_csrf,
    get_principal,
    get_request_session,
    idempotency_key,
    require_permission,
)
from app.api.errors import NotFoundError
from app.core import authz
from app.modules.scoring import repository as repo
from app.modules.scoring import service
from app.modules.scoring.schemas import (
    MatchResultEventView,
    MatchView,
    ScoreRequest,
    StandingsView,
)

router = APIRouter(tags=["scoring"])

_score = require_permission(authz.SCORING_WRITE)


@router.post(
    "/matches/{match_id}/score",
    response_model=MatchView,
    dependencies=[Depends(authed_csrf)],
)
async def score_match(
    match_id: uuid.UUID,
    body: ScoreRequest,
    response: Response,
    principal: Principal = Depends(_score),
    session: AsyncSession = Depends(get_request_session),
    if_match: str | None = Header(default=None, alias="If-Match"),
    idem_key: str | None = Depends(idempotency_key),
) -> MatchView:
    match = await service.score_match(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        match_id=match_id,
        payload=body.payload,
        if_match=if_match,
        idempotency_key=idem_key,
    )
    response.headers["ETag"] = service.match_etag(match)
    return await service.build_match_view_for_org(session, principal.organization_id, match)


@router.post(
    "/matches/{match_id}/start",
    response_model=MatchView,
    dependencies=[Depends(authed_csrf)],
)
async def start_match(
    match_id: uuid.UUID,
    response: Response,
    principal: Principal = Depends(_score),
    session: AsyncSession = Depends(get_request_session),
    if_match: str | None = Header(default=None, alias="If-Match"),
) -> MatchView:
    match = await service.start_match(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        match_id=match_id,
        if_match=if_match,
    )
    response.headers["ETag"] = service.match_etag(match)
    return await service.build_match_view_for_org(session, principal.organization_id, match)


@router.get("/stages/{stage_id}/matches", response_model=list[MatchView])
async def list_stage_matches(
    stage_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> list[MatchView]:
    rows = await repo.list_stage_matches(session, principal.organization_id, stage_id)
    return await service.build_match_views_for_org(session, principal.organization_id, rows)


@router.get("/tournaments/{tournament_id}/matches", response_model=list[MatchView])
async def list_tournament_matches(
    tournament_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> list[MatchView]:
    rows = await repo.list_tournament_matches(session, principal.organization_id, tournament_id)
    return await service.build_match_views_for_org(session, principal.organization_id, rows)


@router.get("/matches/{match_id}", response_model=MatchView)
async def get_match(
    match_id: uuid.UUID,
    response: Response,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> MatchView:
    match = await repo.get_match(session, principal.organization_id, match_id)
    if match is None:
        raise NotFoundError("Match not found")
    response.headers["ETag"] = service.match_etag(match)
    return await service.build_match_view_for_org(session, principal.organization_id, match)


@router.get("/matches/{match_id}/events", response_model=list[MatchResultEventView])
async def list_match_events(
    match_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> list[MatchResultEventView]:
    match = await repo.get_match(session, principal.organization_id, match_id)
    if match is None:
        raise NotFoundError("Match not found")
    rows = await repo.list_match_events(session, principal.organization_id, match_id)
    return [service.build_match_event_view(e, include_actor=True) for e in rows]


@router.get("/stages/{stage_id}/standings", response_model=StandingsView)
async def get_standings(
    stage_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> StandingsView:
    rows = await repo.stage_standings(session, principal.organization_id, stage_id)
    return service.build_standings_view(stage_id, rows)
