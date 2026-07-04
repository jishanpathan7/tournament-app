"""Participant-facing API — my registrations, participations, and matches (portal)."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.enums import ContestKind
from app.db.models import Division, Match, MatchParticipant, Participant, Registration, RosterEntry, Team


async def list_my_registrations(
    session: AsyncSession, user_id: uuid.UUID
) -> Sequence[Registration]:
    stmt = (
        select(Registration)
        .where(Registration.submitted_by == user_id)
        .options(selectinload(Registration.division).selectinload(Division.tournament))
        .order_by(Registration.created_at.desc())
    )
    return (await session.execute(stmt)).scalars().all()


async def list_my_participations(
    session: AsyncSession, user_id: uuid.UUID
) -> Sequence[Participant]:
    stmt = (
        select(Participant)
        .where(Participant.user_id == user_id)
        .options(selectinload(Participant.division).selectinload(Division.tournament))
        .order_by(Participant.created_at.desc())
    )
    return (await session.execute(stmt)).scalars().all()


async def list_my_roster_participations(
    session: AsyncSession, user_id: uuid.UUID
) -> Sequence[Participant]:
    """Participants on teams where the user is a roster member (doubles)."""
    stmt = (
        select(Participant)
        .join(Team, Participant.team_id == Team.id)
        .join(RosterEntry, RosterEntry.team_id == Team.id)
        .where(RosterEntry.user_id == user_id)
        .options(selectinload(Participant.division).selectinload(Division.tournament))
        .order_by(Participant.created_at.desc())
    )
    return (await session.execute(stmt)).scalars().all()


async def list_matches_for_participants(
    session: AsyncSession,
    participant_ids: Sequence[uuid.UUID],
) -> Sequence[Match]:
    if not participant_ids:
        return []
    stmt = (
        select(Match)
        .join(MatchParticipant, MatchParticipant.match_id == Match.id)
        .where(
            MatchParticipant.participant_id.in_(participant_ids),
            Match.contest_kind.in_(
                (ContestKind.STANDARD.value, ContestKind.LEG.value)
            ),
        )
        .options(
            selectinload(Match.participants),
            selectinload(Match.round),
            selectinload(Match.group),
        )
        .distinct()
        .order_by(Match.scheduled_at.nulls_last(), Match.created_at.desc())
    )
    return (await session.execute(stmt)).scalars().all()


async def load_participants_by_id(
    session: AsyncSession, ids: Sequence[uuid.UUID]
) -> dict[uuid.UUID, Participant]:
    if not ids:
        return {}
    stmt = select(Participant).where(Participant.id.in_(ids))
    rows = (await session.execute(stmt)).scalars().all()
    return {p.id: p for p in rows}
