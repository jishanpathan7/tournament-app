"""Venue data access — org-scoped."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.logistics import Venue


async def list_venues(session: AsyncSession, org_id: uuid.UUID) -> Sequence[Venue]:
    stmt = select(Venue).where(Venue.organization_id == org_id).order_by(Venue.name)
    return (await session.execute(stmt)).scalars().all()


async def get_venue(session: AsyncSession, org_id: uuid.UUID, venue_id: uuid.UUID) -> Venue | None:
    stmt = select(Venue).where(Venue.id == venue_id, Venue.organization_id == org_id)
    return (await session.execute(stmt)).scalar_one_or_none()


async def create_venue(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    name: str,
    address: str | None,
    maps_url: str | None,
) -> Venue:
    venue = Venue(organization_id=org_id, name=name, address=address, maps_url=maps_url)
    session.add(venue)
    await session.flush()
    return venue


async def update_venue(
    session: AsyncSession,
    venue: Venue,
    *,
    name: str | None,
    address: str | None,
    clear_address: bool,
    maps_url: str | None,
    clear_maps_url: bool,
) -> Venue:
    if name is not None:
        venue.name = name
    if clear_address:
        venue.address = None
    elif address is not None:
        venue.address = address
    if clear_maps_url:
        venue.maps_url = None
    elif maps_url is not None:
        venue.maps_url = maps_url
    await session.flush()
    return venue
