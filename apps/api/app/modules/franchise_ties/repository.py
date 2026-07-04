"""Franchise tie data access."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.enums import ContestKind, ParticipantKind, ParticipantStatus
from app.db.models import Match, Participant, Stage, Standing


async def get_stage(session: AsyncSession, org_id: uuid.UUID, stage_id: uuid.UUID) -> Stage | None:
    return await session.get(Stage, stage_id)


async def list_squad_participants(
    session: AsyncSession, org_id: uuid.UUID, division_id: uuid.UUID
) -> Sequence[Participant]:
    stmt = (
        select(Participant)
        .where(
            Participant.division_id == division_id,
            Participant.organization_id == org_id,
            Participant.kind == ParticipantKind.SQUAD.value,
        )
        .order_by(Participant.seed, Participant.created_at)
    )
    return (await session.execute(stmt)).scalars().all()


async def get_squad_participant_by_squad(
    session: AsyncSession, org_id: uuid.UUID, division_id: uuid.UUID, squad_id: uuid.UUID
) -> Participant | None:
    stmt = select(Participant).where(
        Participant.division_id == division_id,
        Participant.organization_id == org_id,
        Participant.kind == ParticipantKind.SQUAD.value,
        Participant.squad_id == squad_id,
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_leg_matches(
    session: AsyncSession, org_id: uuid.UUID, tie_match_id: uuid.UUID
) -> Sequence[Match]:
    stmt = (
        select(Match)
        .where(
            Match.parent_match_id == tie_match_id,
            Match.organization_id == org_id,
            Match.contest_kind == ContestKind.LEG.value,
        )
        .options(selectinload(Match.participants))
        .order_by(Match.created_at)
    )
    return (await session.execute(stmt)).scalars().all()


async def list_tie_matches(
    session: AsyncSession, org_id: uuid.UUID, stage_id: uuid.UUID
) -> Sequence[Match]:
    stmt = (
        select(Match)
        .where(
            Match.stage_id == stage_id,
            Match.organization_id == org_id,
            Match.contest_kind == ContestKind.TIE.value,
        )
        .options(selectinload(Match.participants))
        .order_by(Match.created_at)
    )
    return (await session.execute(stmt)).scalars().all()


async def get_match_with_participants(
    session: AsyncSession, org_id: uuid.UUID, match_id: uuid.UUID
) -> Match | None:
    stmt = (
        select(Match)
        .where(Match.id == match_id, Match.organization_id == org_id)
        .options(selectinload(Match.participants))
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_approved_pair_participants(
    session: AsyncSession, org_id: uuid.UUID, division_id: uuid.UUID
) -> Sequence[Participant]:
    stmt = (
        select(Participant)
        .where(
            Participant.division_id == division_id,
            Participant.organization_id == org_id,
            Participant.kind == ParticipantKind.PAIR.value,
            Participant.status == ParticipantStatus.APPROVED.value,
        )
        .order_by(Participant.created_at, Participant.id)
    )
    return (await session.execute(stmt)).scalars().all()


async def tie_has_legs(session: AsyncSession, org_id: uuid.UUID, tie_id: uuid.UUID) -> bool:
    stmt = (
        select(Match.id)
        .where(
            Match.parent_match_id == tie_id,
            Match.organization_id == org_id,
            Match.contest_kind == ContestKind.LEG.value,
        )
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none() is not None


async def squad_participants_by_standings(
    session: AsyncSession,
    org_id: uuid.UUID,
    source_stage_id: uuid.UUID,
    *,
    advance_count: int | None = None,
) -> list[Participant]:
    """Squad participants ordered by rank on a completed franchise RR stage."""
    stmt = (
        select(Participant)
        .join(Standing, Standing.participant_id == Participant.id)
        .where(
            Standing.stage_id == source_stage_id,
            Standing.organization_id == org_id,
            Participant.organization_id == org_id,
            Participant.kind == ParticipantKind.SQUAD.value,
        )
        .order_by(Standing.rank.nulls_last(), Standing.points.desc())
    )
    if advance_count is not None:
        stmt = stmt.limit(advance_count)
    return list((await session.execute(stmt)).scalars().all())
