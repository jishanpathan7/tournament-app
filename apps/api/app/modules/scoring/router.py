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
from app.db.models import Match
from app.modules.scoring import repository as repo
from app.modules.scoring import service
from app.modules.scoring.schemas import (
    MatchSideView,
    MatchView,
    ScoreRequest,
    StandingRowView,
    StandingsView,
)

router = APIRouter(tags=["scoring"])

_score = require_permission(authz.SCORING_WRITE)


def _match_view(match: Match) -> MatchView:
    sides = service._ordered_sides(match)
    score_by_id = {mp.participant_id: mp.score for mp in sides}
    views = []
    for mp in sides:
        other = next((o for o in sides if o.participant_id != mp.participant_id), None)
        against = score_by_id.get(other.participant_id) if other else None
        views.append(
            MatchSideView(
                participant_id=mp.participant_id,
                outcome=mp.outcome,
                score_for=int(mp.score) if mp.score is not None else None,
                score_against=int(against) if against is not None else None,
                rank=mp.rank,
            )
        )
    return MatchView(
        id=match.id,
        stage_id=match.stage_id,
        status=match.status,
        sides=views,
        result_payload=match.result_payload or {},
        round_id=match.round_id,
        round_seq=match.round.seq if match.round else None,
        round_label=match.round.label if match.round else None,
        group_id=match.group_id,
        group_name=match.group.name if match.group else None,
        updated_at=match.updated_at,
    )


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
    return _match_view(match)


@router.get("/stages/{stage_id}/matches", response_model=list[MatchView])
async def list_stage_matches(
    stage_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> list[MatchView]:
    rows = await repo.list_stage_matches(session, principal.organization_id, stage_id)
    return [_match_view(m) for m in rows]


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
    return _match_view(match)


@router.get("/stages/{stage_id}/standings", response_model=StandingsView)
async def get_standings(
    stage_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> StandingsView:
    rows = await repo.stage_standings(session, principal.organization_id, stage_id)
    return StandingsView(
        stage_id=stage_id,
        rows=[
            StandingRowView(
                participant_id=r.participant_id,
                group_id=r.group_id,
                played=r.played,
                won=r.won,
                drawn=r.drawn,
                lost=r.lost,
                points=float(r.points),
                score_for=r.score_for,
                score_against=r.score_against,
                diff=r.score_for - r.score_against,
                rank=r.rank,
            )
            for r in rows
        ],
    )
