"""Venues CRUD — org-scoped, organizer-only."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Principal, authed_csrf, get_principal, get_request_session
from app.api.errors import NotFoundError
from app.modules.venues import repository as repo
from app.modules.venues.schemas import CreateVenueRequest, UpdateVenueRequest, VenueResponse

router = APIRouter(prefix="/venues", tags=["venues"])


def _response(venue: object) -> VenueResponse:
    return VenueResponse(
        id=getattr(venue, "id"),
        name=getattr(venue, "name"),
        address=getattr(venue, "address", None),
        maps_url=getattr(venue, "maps_url", None),
    )


@router.get("", response_model=list[VenueResponse])
async def list_venues(
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> list[VenueResponse]:
    venues = await repo.list_venues(session, principal.organization_id)
    return [_response(v) for v in venues]


@router.post("", response_model=VenueResponse, status_code=201)
async def create_venue(
    body: CreateVenueRequest,
    principal: Principal = Depends(authed_csrf),
    session: AsyncSession = Depends(get_request_session),
) -> VenueResponse:
    venue = await repo.create_venue(
        session,
        org_id=principal.organization_id,
        name=body.name,
        address=body.address,
        maps_url=body.maps_url,
    )
    return _response(venue)


@router.get("/{venue_id}", response_model=VenueResponse)
async def get_venue(
    venue_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> VenueResponse:
    venue = await repo.get_venue(session, principal.organization_id, venue_id)
    if venue is None:
        raise NotFoundError("Venue not found")
    return _response(venue)


@router.patch("/{venue_id}", response_model=VenueResponse)
async def update_venue(
    venue_id: uuid.UUID,
    body: UpdateVenueRequest,
    principal: Principal = Depends(authed_csrf),
    session: AsyncSession = Depends(get_request_session),
) -> VenueResponse:
    venue = await repo.get_venue(session, principal.organization_id, venue_id)
    if venue is None:
        raise NotFoundError("Venue not found")
    venue = await repo.update_venue(
        session,
        venue,
        name=body.name,
        address=body.address,
        clear_address=body.clear_address,
        maps_url=body.maps_url,
        clear_maps_url=body.clear_maps_url,
    )
    return _response(venue)
