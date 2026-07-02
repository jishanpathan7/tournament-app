"""Scheduling HTTP endpoints — assign/move a match's court + time, dry-run conflict
checks, bulk scheduling, unschedule, and the organizer's live queue.

Mutations are guarded by ``schedule:manage`` + CSRF; reads are org-scoped (RLS + repo).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    Principal,
    authed_csrf,
    get_principal,
    get_request_session,
    require_permission,
)
from app.core import authz
from app.modules.scheduling import service
from app.modules.scheduling.schemas import (
    BulkScheduleRequest,
    BulkScheduleResponse,
    ScheduleAssignRequest,
    ScheduleCheckRequest,
    ScheduleCheckResponse,
    ScheduleQueueView,
    ScheduleResultView,
)
from app.modules.scoring.schemas import MatchView
from app.modules.scoring.service import build_match_view

router = APIRouter(tags=["scheduling"])

_manage = require_permission(authz.SCHEDULE_MANAGE)


@router.post("/matches/{match_id}/schedule/check", response_model=ScheduleCheckResponse)
async def check_schedule(
    match_id: uuid.UUID,
    body: ScheduleCheckRequest,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> ScheduleCheckResponse:
    conflicts = await service.check(
        session,
        org_id=principal.organization_id,
        match_id=match_id,
        court_id=body.court_id,
        scheduled_at=body.scheduled_at,
        duration_minutes=body.duration_minutes,
    )
    return ScheduleCheckResponse(conflicts=conflicts)


@router.patch(
    "/matches/{match_id}/schedule",
    response_model=ScheduleResultView,
    dependencies=[Depends(authed_csrf)],
)
async def assign_schedule(
    match_id: uuid.UUID,
    body: ScheduleAssignRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> ScheduleResultView:
    match, conflicts = await service.assign(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        match_id=match_id,
        court_id=body.court_id,
        scheduled_at=body.scheduled_at,
        duration_minutes=body.duration_minutes,
    )
    return ScheduleResultView(match=build_match_view(match), conflicts=conflicts)


@router.delete(
    "/matches/{match_id}/schedule",
    response_model=MatchView,
    dependencies=[Depends(authed_csrf)],
)
async def clear_schedule(
    match_id: uuid.UUID,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> MatchView:
    match = await service.unschedule(
        session, org_id=principal.organization_id, actor_id=principal.user_id, match_id=match_id
    )
    return build_match_view(match)


@router.post(
    "/tournaments/{tournament_id}/schedule/bulk",
    response_model=BulkScheduleResponse,
    dependencies=[Depends(authed_csrf)],
)
async def bulk_assign_schedule(
    tournament_id: uuid.UUID,
    body: BulkScheduleRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> BulkScheduleResponse:
    items = [
        (item.match_id, item.court_id, item.scheduled_at, item.duration_minutes)
        for item in body.assignments
    ]
    results = await service.bulk_assign(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        tournament_id=tournament_id,
        items=items,
    )
    return BulkScheduleResponse(
        results=[
            ScheduleResultView(match=build_match_view(match), conflicts=conflicts)
            for match, conflicts in results
        ]
    )


@router.get("/tournaments/{tournament_id}/schedule/queue", response_model=ScheduleQueueView)
async def get_queue(
    tournament_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> ScheduleQueueView:
    return await service.build_queue(session, principal.organization_id, tournament_id)
