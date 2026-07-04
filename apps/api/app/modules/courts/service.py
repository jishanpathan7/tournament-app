"""Court management use cases — venues, courts, and tournament assignment.

Views built here are shared with the scheduling module (``CourtView`` appears in
timeline/queue responses too) so the shape never drifts between the two.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ConflictError, NotFoundError, ValidationError
from app.db.enums import CourtStatus
from app.db.models import Court, TournamentCourt, Venue
from app.modules.courts import repository as repo
from app.modules.courts.schemas import CourtView, TournamentCourtView, VenueView

_VALID_STATUSES = {s.value for s in CourtStatus}


def build_venue_view(venue: Venue) -> VenueView:
    return VenueView(
        id=venue.id, name=venue.name, address=venue.address, created_at=venue.created_at
    )


def build_court_view(court: Court) -> CourtView:
    return CourtView(
        id=court.id,
        venue_id=court.venue_id,
        venue_name=court.venue.name,
        name=court.name,
        status=court.status,
        created_at=court.created_at,
    )


def build_tournament_court_view(assignment: TournamentCourt) -> TournamentCourtView:
    return TournamentCourtView(
        id=assignment.id,
        tournament_id=assignment.tournament_id,
        court=build_court_view(assignment.court),
        created_at=assignment.created_at,
    )


async def create_venue(
    session: AsyncSession, *, org_id: uuid.UUID, name: str, address: str | None
) -> Venue:
    return await repo.create_venue(
        session, Venue(organization_id=org_id, name=name, address=address)
    )


async def list_venues(session: AsyncSession, org_id: uuid.UUID) -> Sequence[Venue]:
    return await repo.list_venues(session, org_id)


async def create_court(
    session: AsyncSession, *, org_id: uuid.UUID, venue_id: uuid.UUID, name: str
) -> Court:
    venue = await repo.get_venue(session, org_id, venue_id)
    if venue is None:
        raise NotFoundError("Venue not found")
    court = await repo.create_court(
        session, Court(organization_id=org_id, venue_id=venue_id, name=name)
    )
    court.venue = venue
    return court


async def update_court(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    court_id: uuid.UUID,
    name: str | None,
    status: str | None,
) -> Court:
    court = await repo.get_court(session, org_id, court_id)
    if court is None:
        raise NotFoundError("Court not found")
    if status is not None and status not in _VALID_STATUSES:
        raise ValidationError(f"Unknown court status: {status}", code="invalid_court_status")
    if name is not None:
        court.name = name
    if status is not None:
        court.status = status
    await session.flush()
    return court


async def list_courts(session: AsyncSession, org_id: uuid.UUID) -> Sequence[Court]:
    return await repo.list_courts(session, org_id)


async def get_court(session: AsyncSession, org_id: uuid.UUID, court_id: uuid.UUID) -> Court:
    court = await repo.get_court(session, org_id, court_id)
    if court is None:
        raise NotFoundError("Court not found")
    return court


async def assign_court(
    session: AsyncSession, *, org_id: uuid.UUID, tournament_id: uuid.UUID, court_id: uuid.UUID
) -> TournamentCourt:
    tournament = await repo.get_tournament(session, org_id, tournament_id)
    if tournament is None:
        raise NotFoundError("Tournament not found")
    court = await repo.get_court(session, org_id, court_id)
    if court is None:
        raise NotFoundError("Court not found")
    existing = await repo.get_tournament_court(session, org_id, tournament_id, court_id)
    if existing is not None:
        raise ConflictError("Court is already assigned to this tournament", code="already_assigned")
    assignment = await repo.create_tournament_court(
        session,
        TournamentCourt(organization_id=org_id, tournament_id=tournament_id, court_id=court_id),
    )
    assignment.court = court
    return assignment


async def unassign_court(
    session: AsyncSession, *, org_id: uuid.UUID, tournament_id: uuid.UUID, court_id: uuid.UUID
) -> None:
    assignment = await repo.get_tournament_court(session, org_id, tournament_id, court_id)
    if assignment is None:
        raise NotFoundError("Court is not assigned to this tournament")
    await repo.delete_tournament_court(session, assignment)


async def list_tournament_courts(
    session: AsyncSession, org_id: uuid.UUID, tournament_id: uuid.UUID
) -> Sequence[TournamentCourt]:
    return await repo.list_tournament_courts(session, org_id, tournament_id)


async def bulk_create_courts(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    tournament_id: uuid.UUID,
    venue_id: uuid.UUID | None,
    new_venue_name: str | None,
    count: int,
    name_prefix: str,
    start_number: int,
) -> list[TournamentCourt]:
    tournament = await repo.get_tournament(session, org_id, tournament_id)
    if tournament is None:
        raise NotFoundError("Tournament not found")

    if venue_id is None:
        if not new_venue_name or not new_venue_name.strip():
            raise ValidationError("venue_id or new_venue_name is required", code="missing_venue")
        venue = await repo.create_venue(
            session, Venue(organization_id=org_id, name=new_venue_name.strip(), address=None)
        )
    else:
        _found = await repo.get_venue(session, org_id, venue_id)
        if _found is None:
            raise NotFoundError("Venue not found")
        venue = _found

    created: list[TournamentCourt] = []
    for i in range(count):
        name = f"{name_prefix}{start_number + i}"
        if len(name) > 80:
            raise ValidationError(f"Court name too long: {name!r}", code="court_name_too_long")
        court = await repo.create_court(
            session, Court(organization_id=org_id, venue_id=venue.id, name=name)
        )
        court.venue = venue
        assignment = await repo.create_tournament_court(
            session,
            TournamentCourt(organization_id=org_id, tournament_id=tournament_id, court_id=court.id),
        )
        assignment.court = court
        created.append(assignment)
    return created


async def bulk_unassign_courts(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    tournament_id: uuid.UUID,
    court_ids: list[uuid.UUID],
) -> list[uuid.UUID]:
    tournament = await repo.get_tournament(session, org_id, tournament_id)
    if tournament is None:
        raise NotFoundError("Tournament not found")

    assignments: list[TournamentCourt] = []
    for court_id in court_ids:
        assignment = await repo.get_tournament_court(session, org_id, tournament_id, court_id)
        if assignment is None:
            raise NotFoundError("Court is not assigned to this tournament")
        assignments.append(assignment)

    for assignment in assignments:
        await repo.delete_tournament_court(session, assignment)
    return court_ids
