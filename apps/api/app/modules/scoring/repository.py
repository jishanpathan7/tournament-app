"""Data access for scoring — org-scoped; matches loaded with their sides."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    Division,
    IdempotencyKey,
    Match,
    MatchResultEvent,
    Participant,
    SportProfile,
    Stage,
    Standing,
    Team,
    Tournament,
)


async def get_match(session: AsyncSession, org_id: uuid.UUID, mid: uuid.UUID) -> Match | None:
    stmt = (
        select(Match)
        .where(Match.id == mid, Match.organization_id == org_id)
        .options(
            selectinload(Match.participants), selectinload(Match.round), selectinload(Match.group)
        )
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_stage_matches(
    session: AsyncSession, org_id: uuid.UUID, sid: uuid.UUID
) -> Sequence[Match]:
    stmt = (
        select(Match)
        .where(Match.stage_id == sid, Match.organization_id == org_id)
        .options(
            selectinload(Match.participants), selectinload(Match.round), selectinload(Match.group)
        )
        .order_by(Match.round_id.nulls_first(), Match.created_at, Match.id)
    )
    return (await session.execute(stmt)).scalars().all()


async def list_tournament_matches(
    session: AsyncSession, org_id: uuid.UUID, tid: uuid.UUID
) -> Sequence[Match]:
    """Every match across every division/stage of a tournament — the Match Center queue.
    ``Match.tournament_id`` is denormalized directly onto the row, so this needs no join
    through Stage/Division."""
    stmt = (
        select(Match)
        .where(Match.tournament_id == tid, Match.organization_id == org_id)
        .options(
            selectinload(Match.participants), selectinload(Match.round), selectinload(Match.group)
        )
        .order_by(Match.scheduled_at.nulls_last(), Match.created_at, Match.id)
    )
    return (await session.execute(stmt)).scalars().all()


async def list_match_events(
    session: AsyncSession, org_id: uuid.UUID, mid: uuid.UUID
) -> Sequence[MatchResultEvent]:
    stmt = (
        select(MatchResultEvent)
        .where(MatchResultEvent.match_id == mid, MatchResultEvent.organization_id == org_id)
        .order_by(MatchResultEvent.created_at)
    )
    return (await session.execute(stmt)).scalars().all()


async def live_match_on_court(
    session: AsyncSession, org_id: uuid.UUID, court_id: uuid.UUID, exclude_match_id: uuid.UUID
) -> Match | None:
    """Return a live match on `court_id` that isn't `exclude_match_id`, or None."""
    from app.db.enums import MatchStatus  # local import to avoid circular

    stmt = select(Match).where(
        Match.organization_id == org_id,
        Match.court_id == court_id,
        Match.status == MatchStatus.LIVE.value,
        Match.id != exclude_match_id,
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_stage(session: AsyncSession, org_id: uuid.UUID, sid: uuid.UUID) -> Stage | None:
    stmt = select(Stage).where(Stage.id == sid, Stage.organization_id == org_id)
    return (await session.execute(stmt)).scalar_one_or_none()


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


async def get_participant(
    session: AsyncSession, org_id: uuid.UUID, pid: uuid.UUID
) -> Participant | None:
    stmt = select(Participant).where(Participant.id == pid, Participant.organization_id == org_id)
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_team(session: AsyncSession, org_id: uuid.UUID, tid: uuid.UUID) -> Team | None:
    stmt = select(Team).where(Team.id == tid, Team.organization_id == org_id)
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_idempotency(
    session: AsyncSession, org_id: uuid.UUID, key: str
) -> IdempotencyKey | None:
    stmt = select(IdempotencyKey).where(
        IdempotencyKey.organization_id == org_id, IdempotencyKey.key == key
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def stage_standings(
    session: AsyncSession, org_id: uuid.UUID, sid: uuid.UUID
) -> Sequence[Standing]:
    stmt = (
        select(Standing)
        .where(Standing.stage_id == sid, Standing.organization_id == org_id)
        .order_by(Standing.group_id.nulls_first(), Standing.rank.nulls_last())
    )
    return (await session.execute(stmt)).scalars().all()
