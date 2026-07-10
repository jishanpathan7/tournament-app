"""Data access for courts — org-scoped."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Court, Tournament, TournamentCourt, Venue


async def create_venue(session: AsyncSession, venue: Venue) -> Venue:
    session.add(venue)
    await session.flush()
    return venue


async def get_venue(session: AsyncSession, org_id: uuid.UUID, vid: uuid.UUID) -> Venue | None:
    stmt = select(Venue).where(Venue.id == vid, Venue.organization_id == org_id)
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_venues(session: AsyncSession, org_id: uuid.UUID) -> Sequence[Venue]:
    stmt = select(Venue).where(Venue.organization_id == org_id).order_by(Venue.name)
    return (await session.execute(stmt)).scalars().all()


async def create_court(session: AsyncSession, court: Court) -> Court:
    session.add(court)
    await session.flush()
    return court


async def get_court(session: AsyncSession, org_id: uuid.UUID, cid: uuid.UUID) -> Court | None:
    stmt = (
        select(Court)
        .where(Court.id == cid, Court.organization_id == org_id)
        .options(selectinload(Court.venue))
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_courts(session: AsyncSession, org_id: uuid.UUID) -> Sequence[Court]:
    stmt = (
        select(Court)
        .where(Court.organization_id == org_id)
        .options(selectinload(Court.venue))
        .order_by(Court.name)
    )
    return (await session.execute(stmt)).scalars().all()


async def get_tournament(
    session: AsyncSession, org_id: uuid.UUID, tid: uuid.UUID
) -> Tournament | None:
    stmt = select(Tournament).where(Tournament.id == tid, Tournament.organization_id == org_id)
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_tournament_court(
    session: AsyncSession, org_id: uuid.UUID, tid: uuid.UUID, cid: uuid.UUID
) -> TournamentCourt | None:
    stmt = select(TournamentCourt).where(
        TournamentCourt.tournament_id == tid,
        TournamentCourt.court_id == cid,
        TournamentCourt.organization_id == org_id,
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def create_tournament_court(
    session: AsyncSession, assignment: TournamentCourt
) -> TournamentCourt:
    session.add(assignment)
    await session.flush()
    return assignment


async def delete_tournament_court(session: AsyncSession, assignment: TournamentCourt) -> None:
    await session.delete(assignment)
    await session.flush()


async def delete_court(session: AsyncSession, court: Court) -> None:
    await session.delete(court)
    await session.flush()


async def list_tournament_courts(
    session: AsyncSession, org_id: uuid.UUID, tid: uuid.UUID
) -> Sequence[TournamentCourt]:
    stmt = (
        select(TournamentCourt)
        .where(TournamentCourt.tournament_id == tid, TournamentCourt.organization_id == org_id)
        .options(selectinload(TournamentCourt.court).selectinload(Court.venue))
        .order_by(TournamentCourt.created_at)
    )
    return (await session.execute(stmt)).scalars().all()
