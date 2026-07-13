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

from app.db.enums import ContestKind, MatchStatus
from app.db.models import Court, Match, Participant, Registration, TournamentCourt


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


async def get_courts_by_ids(
    session: AsyncSession,
    org_id: uuid.UUID,
    court_ids: Sequence[uuid.UUID],
) -> dict[uuid.UUID, Court]:
    """Batch-load courts — avoids N get_court calls in bulk scheduling."""
    if not court_ids:
        return {}
    stmt = select(Court).where(Court.organization_id == org_id, Court.id.in_(court_ids))
    rows = (await session.execute(stmt)).scalars().all()
    return {c.id: c for c in rows}


async def get_matches_by_ids(
    session: AsyncSession,
    org_id: uuid.UUID,
    match_ids: Sequence[uuid.UUID],
) -> dict[uuid.UUID, Match]:
    """Batch-load matches with participants in one query — avoids N SELECT per bulk item."""
    if not match_ids:
        return {}
    stmt = (
        select(Match)
        .where(Match.organization_id == org_id, Match.id.in_(match_ids))
        .options(selectinload(Match.participants))
    )
    rows = (await session.execute(stmt)).scalars().all()
    return {m.id: m for m in rows}


async def get_tournament_courts_by_court_ids(
    session: AsyncSession,
    org_id: uuid.UUID,
    tournament_id: uuid.UUID,
    court_ids: Sequence[uuid.UUID],
) -> dict[uuid.UUID, TournamentCourt]:
    """Batch-load TournamentCourt assignments for the given court ids."""
    if not court_ids:
        return {}
    stmt = select(TournamentCourt).where(
        TournamentCourt.organization_id == org_id,
        TournamentCourt.tournament_id == tournament_id,
        TournamentCourt.court_id.in_(court_ids),
    )
    rows = (await session.execute(stmt)).scalars().all()
    return {tc.court_id: tc for tc in rows}


async def list_tournament_matches_with_participants(
    session: AsyncSession, org_id: uuid.UUID, tournament_id: uuid.UUID
) -> Sequence[Match]:
    """Every non-tie match in the tournament — the source for the queue view's
    scheduled/unscheduled/pending buckets."""
    stmt = (
        select(Match)
        .where(
            Match.tournament_id == tournament_id,
            Match.organization_id == org_id,
            Match.contest_kind != ContestKind.TIE.value,
        )
        .options(
            selectinload(Match.participants), selectinload(Match.round), selectinload(Match.group)
        )
        .order_by(Match.scheduled_at.nulls_last(), Match.created_at, Match.id)
    )
    return (await session.execute(stmt)).scalars().all()


_AUTO_SCHEDULE_TERMINAL = frozenset(
    [
        MatchStatus.COMPLETED.value,
        MatchStatus.WALKOVER.value,
        MatchStatus.NO_SHOW.value,
        MatchStatus.CANCELLED.value,
    ]
)


async def get_next_schedulable_match(
    session: AsyncSession,
    org_id: uuid.UUID,
    tournament_id: uuid.UUID,
) -> Match | None:
    """Single targeted query for auto_schedule_next — avoids full match scan.

    Returns the first unscheduled non-pending non-terminal non-tie match ordered
    by round sequence then creation time.
    """
    stmt = (
        select(Match)
        .where(
            Match.tournament_id == tournament_id,
            Match.organization_id == org_id,
            Match.contest_kind != ContestKind.TIE.value,
            Match.status.not_in(list(_AUTO_SCHEDULE_TERMINAL)),
            Match.status != MatchStatus.PENDING.value,
            (Match.court_id.is_(None) | Match.scheduled_at.is_(None)),
        )
        .options(selectinload(Match.participants), selectinload(Match.round))
        .order_by(Match.created_at, Match.id)
        .limit(1)
    )
    return (await session.execute(stmt)).scalars().first()


async def get_participant_emails_by_ids(
    session: AsyncSession,
    org_id: uuid.UUID,
    participant_ids: Sequence[uuid.UUID],
) -> dict[uuid.UUID, str | None]:
    """Batch-load participant emails from their approved registrations.

    Returns a mapping of participant_id → email string (or None if not found).
    Replaces per-participant ``_participant_email`` calls in the bulk schedule path.
    """
    if not participant_ids:
        return {}
    stmt = select(Registration.participant_id, Registration.form_response).where(
        Registration.organization_id == org_id,
        Registration.participant_id.in_(participant_ids),
    )
    rows = (await session.execute(stmt)).all()
    result: dict[uuid.UUID, str | None] = {}
    for participant_id, form_response in rows:
        email = (form_response or {}).get("email")
        result[participant_id] = str(email).strip() if email else None
    return result
