"""Data access for Smart Pairing — org-scoped."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.enums import PairingRunStatus, ParticipantKind, RegistrationStatus
from app.db.models import (
    Division,
    PairingRun,
    Participant,
    ProposedTeam,
    Registration,
    SportProfile,
    Team,
    Tournament,
    User,
)

# Registrations eligible to be paired: still awaiting placement and not yet materialized
# into a participant. Publishing flips them to `approved`, which drops them from the pool.
_ELIGIBLE = {RegistrationStatus.SUBMITTED.value, RegistrationStatus.WAITLISTED.value}


async def get_division(session: AsyncSession, org_id: uuid.UUID, did: uuid.UUID) -> Division | None:
    stmt = select(Division).where(Division.id == did, Division.organization_id == org_id)
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


async def get_latest_published_run(
    session: AsyncSession, org_id: uuid.UUID, division_id: uuid.UUID
) -> PairingRun | None:
    stmt = (
        select(PairingRun)
        .where(
            PairingRun.division_id == division_id,
            PairingRun.organization_id == org_id,
            PairingRun.status == PairingRunStatus.PUBLISHED.value,
        )
        .options(selectinload(PairingRun.proposed_teams))
        .order_by(PairingRun.created_at.desc())
    )
    return (await session.execute(stmt)).scalars().first()


async def list_pair_participants(
    session: AsyncSession, org_id: uuid.UUID, division_id: uuid.UUID
) -> Sequence[Participant]:
    stmt = (
        select(Participant)
        .where(
            Participant.division_id == division_id,
            Participant.organization_id == org_id,
            Participant.kind == ParticipantKind.PAIR.value,
        )
        .order_by(Participant.created_at, Participant.id)
    )
    return (await session.execute(stmt)).scalars().all()


async def get_team_with_roster(
    session: AsyncSession, org_id: uuid.UUID, team_id: uuid.UUID
) -> Team | None:
    stmt = (
        select(Team)
        .where(Team.id == team_id, Team.organization_id == org_id)
        .options(selectinload(Team.roster_entries))
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_eligible_registrations(
    session: AsyncSession, org_id: uuid.UUID, division_id: uuid.UUID
) -> Sequence[Registration]:
    stmt = (
        select(Registration)
        .where(
            Registration.division_id == division_id,
            Registration.organization_id == org_id,
            Registration.participant_id.is_(None),
            Registration.status.in_(_ELIGIBLE),
        )
        .order_by(Registration.created_at, Registration.id)
    )
    return (await session.execute(stmt)).scalars().all()


async def get_active_run(
    session: AsyncSession, org_id: uuid.UUID, division_id: uuid.UUID
) -> PairingRun | None:
    """The current draft run for a division (at most one is kept 'draft' at a time)."""
    stmt = (
        select(PairingRun)
        .where(
            PairingRun.division_id == division_id,
            PairingRun.organization_id == org_id,
            PairingRun.status == PairingRunStatus.DRAFT.value,
        )
        .options(selectinload(PairingRun.proposed_teams))
        .order_by(PairingRun.created_at.desc())
    )
    return (await session.execute(stmt)).scalars().first()


async def get_run(session: AsyncSession, org_id: uuid.UUID, run_id: uuid.UUID) -> PairingRun | None:
    stmt = (
        select(PairingRun)
        .where(PairingRun.id == run_id, PairingRun.organization_id == org_id)
        .options(selectinload(PairingRun.proposed_teams))
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_proposed_team(
    session: AsyncSession, org_id: uuid.UUID, team_id: uuid.UUID
) -> ProposedTeam | None:
    stmt = select(ProposedTeam).where(
        ProposedTeam.id == team_id, ProposedTeam.organization_id == org_id
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_published_pairings(
    session: AsyncSession, org_id: uuid.UUID, division_id: uuid.UUID
) -> list[tuple[str, str]]:
    """Member pairs from already-published runs in this division — so a re-pair avoids
    reusing partners (cross-round repeat avoidance)."""
    stmt = (
        select(ProposedTeam.member_ids)
        .join(PairingRun, ProposedTeam.pairing_run_id == PairingRun.id)
        .where(
            PairingRun.division_id == division_id,
            PairingRun.organization_id == org_id,
            PairingRun.status == PairingRunStatus.PUBLISHED.value,
        )
    )
    pairs: list[tuple[str, str]] = []
    for (member_ids,) in (await session.execute(stmt)).all():
        ids = list(member_ids or [])
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                pairs.append((str(ids[i]), str(ids[j])))
    return pairs
