"""Court management HTTP endpoints — venues, courts, and tournament assignment.

Mutations are guarded by ``schedule:manage`` + CSRF; reads are org-scoped (RLS + repo).
"""

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
from app.modules.courts import service
from app.modules.courts.schemas import (
    AssignCourtRequest,
    CourtView,
    CreateCourtRequest,
    CreateVenueRequest,
    TournamentCourtView,
    UpdateCourtRequest,
    VenueView,
)

router = APIRouter(tags=["courts"])

_manage = require_permission(authz.SCHEDULE_MANAGE)


@router.post(
    "/venues",
    response_model=VenueView,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(authed_csrf)],
)
async def create_venue(
    body: CreateVenueRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> VenueView:
    venue = await service.create_venue(
        session, org_id=principal.organization_id, name=body.name, address=body.address
    )
    return service.build_venue_view(venue)


@router.get("/venues", response_model=list[VenueView])
async def list_venues(
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> list[VenueView]:
    rows = await service.list_venues(session, principal.organization_id)
    return [service.build_venue_view(v) for v in rows]


@router.post(
    "/courts",
    response_model=CourtView,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(authed_csrf)],
)
async def create_court(
    body: CreateCourtRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> CourtView:
    court = await service.create_court(
        session, org_id=principal.organization_id, venue_id=body.venue_id, name=body.name
    )
    return service.build_court_view(court)


@router.get("/courts", response_model=list[CourtView])
async def list_courts(
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> list[CourtView]:
    rows = await service.list_courts(session, principal.organization_id)
    return [service.build_court_view(c) for c in rows]


@router.patch(
    "/courts/{court_id}",
    response_model=CourtView,
    dependencies=[Depends(authed_csrf)],
)
async def update_court(
    court_id: uuid.UUID,
    body: UpdateCourtRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> CourtView:
    court = await service.update_court(
        session,
        org_id=principal.organization_id,
        court_id=court_id,
        name=body.name,
        status=body.status,
    )
    return service.build_court_view(court)


@router.post(
    "/tournaments/{tournament_id}/courts",
    response_model=TournamentCourtView,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(authed_csrf)],
)
async def assign_court(
    tournament_id: uuid.UUID,
    body: AssignCourtRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> TournamentCourtView:
    assignment = await service.assign_court(
        session,
        org_id=principal.organization_id,
        tournament_id=tournament_id,
        court_id=body.court_id,
    )
    return service.build_tournament_court_view(assignment)


@router.get("/tournaments/{tournament_id}/courts", response_model=list[TournamentCourtView])
async def list_tournament_courts(
    tournament_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> list[TournamentCourtView]:
    rows = await service.list_tournament_courts(session, principal.organization_id, tournament_id)
    return [service.build_tournament_court_view(a) for a in rows]


@router.delete(
    "/tournaments/{tournament_id}/courts/{court_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(authed_csrf)],
)
async def unassign_court(
    tournament_id: uuid.UUID,
    court_id: uuid.UUID,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> None:
    await service.unassign_court(
        session, org_id=principal.organization_id, tournament_id=tournament_id, court_id=court_id
    )
