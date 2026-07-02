"""Data access for scheduling — org-scoped.

Match reads reuse ``scoring.repository`` (same eager-load shape the scoring router
and public microsite already rely on) rather than redefining them here.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Match, Participant


async def list_scheduled_matches(
    session: AsyncSession,
    org_id: uuid.UUID,
    tournament_id: uuid.UUID,
    *,
    exclude_match_id: uuid.UUID | None = None,
) -> Sequence[Match]:
    """Every match in the tournament that already has a court + time — the candidate
    set to check a new/moved assignment against for overlaps."""
    stmt = (
        select(Match)
        .where(
            Match.tournament_id == tournament_id,
            Match.organization_id == org_id,
            Match.court_id.is_not(None),
            Match.scheduled_at.is_not(None),
        )
        .options(selectinload(Match.participants))
    )
    if exclude_match_id is not None:
        stmt = stmt.where(Match.id != exclude_match_id)
    return (await session.execute(stmt)).scalars().all()


async def participant_kinds(
    session: AsyncSession, org_id: uuid.UUID, participant_ids: set[uuid.UUID]
) -> dict[uuid.UUID, str]:
    """Batch lookup of ``Participant.kind`` — distinguishes a "team overlap" warning
    from a plain "participant overlap" one without an N+1 query per conflict."""
    if not participant_ids:
        return {}
    stmt = select(Participant.id, Participant.kind).where(
        Participant.organization_id == org_id, Participant.id.in_(participant_ids)
    )
    rows = (await session.execute(stmt)).all()
    return {row[0]: row[1] for row in rows}


async def list_tournament_matches_with_participants(
    session: AsyncSession, org_id: uuid.UUID, tournament_id: uuid.UUID
) -> Sequence[Match]:
    """Every match in the tournament — the source for the queue view's
    scheduled/unscheduled/pending buckets."""
    stmt = (
        select(Match)
        .where(Match.tournament_id == tournament_id, Match.organization_id == org_id)
        .options(
            selectinload(Match.participants), selectinload(Match.round), selectinload(Match.group)
        )
        .order_by(Match.scheduled_at.nulls_last(), Match.created_at, Match.id)
    )
    return (await session.execute(stmt)).scalars().all()
