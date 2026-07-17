"""Data access for registrations/participants — org-scoped at the app layer."""

from __future__ import annotations

import uuid
from collections.abc import Collection, Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.enums import ParticipantStatus
from app.db.models import (
    Division,
    Participant,
    Registration,
    SportProfile,
    Team,
    Tournament,
    User,
)


async def get_registration(
    session: AsyncSession, org_id: uuid.UUID, rid: uuid.UUID
) -> Registration | None:
    stmt = select(Registration).where(
        Registration.id == rid, Registration.organization_id == org_id
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_registrations(
    session: AsyncSession, org_id: uuid.UUID, division_id: uuid.UUID
) -> Sequence[Registration]:
    stmt = (
        select(Registration)
        .where(Registration.division_id == division_id, Registration.organization_id == org_id)
        .order_by(Registration.created_at)
    )
    return (await session.execute(stmt)).scalars().all()


async def list_registrations_for_tournament(
    session: AsyncSession, org_id: uuid.UUID, tournament_id: uuid.UUID
) -> Sequence[Registration]:
    stmt = (
        select(Registration)
        .join(Division, Registration.division_id == Division.id)
        .where(Division.tournament_id == tournament_id, Registration.organization_id == org_id)
        .order_by(Registration.created_at)
    )
    return (await session.execute(stmt)).scalars().all()


async def count_approved(session: AsyncSession, org_id: uuid.UUID, division_id: uuid.UUID) -> int:
    stmt = select(func.count()).where(
        Participant.division_id == division_id,
        Participant.organization_id == org_id,
        Participant.status == ParticipantStatus.APPROVED.value,
    )
    return int((await session.execute(stmt)).scalar_one())


async def list_participants(
    session: AsyncSession, org_id: uuid.UUID, division_id: uuid.UUID
) -> Sequence[Participant]:
    stmt = (
        select(Participant)
        .where(Participant.division_id == division_id, Participant.organization_id == org_id)
        .options(selectinload(Participant.team))
        .order_by(Participant.created_at)
    )
    return (await session.execute(stmt)).scalars().all()


async def list_participants_for_tournament(
    session: AsyncSession, org_id: uuid.UUID, tournament_id: uuid.UUID
) -> Sequence[Participant]:
    stmt = (
        select(Participant)
        .join(Division, Participant.division_id == Division.id)
        .where(Division.tournament_id == tournament_id, Participant.organization_id == org_id)
        .options(selectinload(Participant.team))
        .order_by(Participant.created_at)
    )
    return (await session.execute(stmt)).scalars().all()


async def get_division(
    session: AsyncSession,
    org_id: uuid.UUID,
    did: uuid.UUID,
    *,
    for_update: bool = False,
) -> Division | None:
    stmt = select(Division).where(Division.id == did, Division.organization_id == org_id)
    if for_update:
        stmt = stmt.with_for_update()
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_tournament(
    session: AsyncSession, org_id: uuid.UUID, tid: uuid.UUID
) -> Tournament | None:
    stmt = select(Tournament).where(Tournament.id == tid, Tournament.organization_id == org_id)
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_sport_profile(session: AsyncSession, pid: uuid.UUID) -> SportProfile | None:
    return await session.get(SportProfile, pid)


async def get_user(session: AsyncSession, uid: uuid.UUID) -> User | None:
    return await session.get(User, uid)


async def get_registrations_by_ids(
    session: AsyncSession, org_id: uuid.UUID, ids: Collection[uuid.UUID]
) -> dict[uuid.UUID, Registration]:
    """Batch-load registrations by primary key — one SELECT instead of N session.get calls."""
    if not ids:
        return {}
    stmt = select(Registration).where(
        Registration.id.in_(ids), Registration.organization_id == org_id
    )
    rows = (await session.execute(stmt)).scalars().all()
    return {r.id: r for r in rows}


async def get_users_by_ids(
    session: AsyncSession, ids: Collection[uuid.UUID]
) -> dict[uuid.UUID, User]:
    """Batch-load users by primary key — one SELECT instead of N identity-map lookups."""
    if not ids:
        return {}
    stmt = select(User).where(User.id.in_(ids))
    rows = (await session.execute(stmt)).scalars().all()
    return {u.id: u for u in rows}


async def list_eligible_for_bulk_approve(
    session: AsyncSession, org_id: uuid.UUID, division_id: uuid.UUID
) -> Sequence[Registration]:
    """Registrations in SUBMITTED or WAITLISTED status — candidates for approve-all."""
    from app.db.enums import RegistrationStatus

    stmt = (
        select(Registration)
        .where(
            Registration.division_id == division_id,
            Registration.organization_id == org_id,
            Registration.status.in_(
                [RegistrationStatus.SUBMITTED.value, RegistrationStatus.WAITLISTED.value]
            ),
        )
        .order_by(Registration.created_at)
    )
    return (await session.execute(stmt)).scalars().all()


async def get_team_with_roster(
    session: AsyncSession, org_id: uuid.UUID, tid: uuid.UUID
) -> Team | None:
    stmt = (
        select(Team)
        .where(Team.id == tid, Team.organization_id == org_id)
        .options(selectinload(Team.roster_entries))
    )
    return (await session.execute(stmt)).scalar_one_or_none()
