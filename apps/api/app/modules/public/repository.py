"""Data access for the public microsite.

Two distinct scoping regimes in this file, deliberately kept apart:

  * ``search_tournaments`` and ``get_tournament_by_slug`` run with NO org context —
    they're how an anonymous request bootstraps into a tournament (or searches across
    every org's public tournaments at once). Every query here filters `visibility`
    explicitly in the WHERE clause; never rely on RLS alone (locally the DB role is a
    superuser and bypasses RLS entirely — see `app.db.rls` — so the app-layer filter
    IS the real fence, not just defense in depth).
  * Everything else takes an already-resolved, already-verified ``org_id`` +
    ``tournament_id`` and runs AFTER the caller has set org context for that org — at
    that point every table's normal org-isolation policy applies, same as any
    authenticated module. These functions additionally re-check that the requested
    row (division/stage/participant/match) actually belongs to ``tournament_id`` —
    org context alone isn't enough if an org runs more than one tournament.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.enums import ParticipantStatus, Visibility
from app.db.models import Division, Match, Participant, Stage, Tournament


async def get_tournament_by_slug(session: AsyncSession, slug: str) -> Tournament | None:
    """Resolve a tournament by slug alone, across every org — no org context set.
    Relies on `tournaments_public_read` (see `app.db.rls`) plus this explicit filter."""
    stmt = (
        select(Tournament)
        .where(
            Tournament.slug == slug,
            Tournament.visibility.in_([Visibility.PUBLIC.value, Visibility.UNLISTED.value]),
            Tournament.deleted_at.is_(None),
        )
        .options(selectinload(Tournament.organization))
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def search_tournaments(
    session: AsyncSession, query: str, limit: int = 20
) -> Sequence[Tournament]:
    """Cross-org discovery search. Only fully `public` — `unlisted` is reachable by
    direct slug link (see `get_tournament_by_slug`) but deliberately not searchable."""
    pattern = f"%{query}%"
    stmt = (
        select(Tournament)
        .where(
            Tournament.visibility == Visibility.PUBLIC.value,
            Tournament.deleted_at.is_(None),
            (Tournament.name.ilike(pattern) | Tournament.slug.ilike(pattern)),
        )
        .options(selectinload(Tournament.organization))
        .order_by(Tournament.created_at.desc())
        .limit(limit)
    )
    return (await session.execute(stmt)).scalars().all()


async def get_division(
    session: AsyncSession, org_id: uuid.UUID, tid: uuid.UUID, did: uuid.UUID
) -> Division | None:
    stmt = select(Division).where(
        Division.id == did,
        Division.organization_id == org_id,
        Division.tournament_id == tid,
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def division_approved_counts(
    session: AsyncSession, org_id: uuid.UUID, division_ids: Sequence[uuid.UUID]
) -> dict[uuid.UUID, int]:
    if not division_ids:
        return {}
    stmt = (
        select(Participant.division_id, func.count())
        .where(
            Participant.division_id.in_(division_ids),
            Participant.organization_id == org_id,
            Participant.status == ParticipantStatus.APPROVED.value,
        )
        .group_by(Participant.division_id)
    )
    rows = (await session.execute(stmt)).all()
    return {division_id: count for division_id, count in rows}


async def list_stages(session: AsyncSession, org_id: uuid.UUID, tid: uuid.UUID) -> Sequence[Stage]:
    """Every stage across every division of a tournament — the public module's own
    fan-out (no cross-division stage listing exists in the authenticated API either)."""
    stmt = (
        select(Stage)
        .join(Division, Division.id == Stage.division_id)
        .where(Division.tournament_id == tid, Stage.organization_id == org_id)
        .order_by(Stage.seq)
    )
    return (await session.execute(stmt)).scalars().all()


async def stage_match_counts(
    session: AsyncSession, org_id: uuid.UUID, stage_ids: Sequence[uuid.UUID]
) -> dict[uuid.UUID, int]:
    """One bulk query for "is this stage drawn" across every stage of a tournament,
    instead of a per-stage round trip."""
    if not stage_ids:
        return {}
    stmt = (
        select(Match.stage_id, func.count())
        .where(Match.stage_id.in_(stage_ids), Match.organization_id == org_id)
        .group_by(Match.stage_id)
    )
    rows = (await session.execute(stmt)).all()
    return {stage_id: count for stage_id, count in rows}


async def get_stage(
    session: AsyncSession, org_id: uuid.UUID, tid: uuid.UUID, sid: uuid.UUID
) -> Stage | None:
    stmt = (
        select(Stage)
        .join(Division, Division.id == Stage.division_id)
        .where(Stage.id == sid, Stage.organization_id == org_id, Division.tournament_id == tid)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_participants(
    session: AsyncSession, org_id: uuid.UUID, tid: uuid.UUID
) -> Sequence[Participant]:
    """Approved participants across every division of the tournament."""
    stmt = (
        select(Participant)
        .join(Division, Division.id == Participant.division_id)
        .where(
            Division.tournament_id == tid,
            Participant.organization_id == org_id,
            Participant.status == ParticipantStatus.APPROVED.value,
        )
        .options(selectinload(Participant.team))
        .order_by(Participant.seed.nulls_last(), Participant.created_at)
    )
    return (await session.execute(stmt)).scalars().all()


async def get_participant(
    session: AsyncSession, org_id: uuid.UUID, tid: uuid.UUID, pid: uuid.UUID
) -> Participant | None:
    stmt = (
        select(Participant)
        .join(Division, Division.id == Participant.division_id)
        .where(
            Participant.id == pid,
            Participant.organization_id == org_id,
            Division.tournament_id == tid,
            Participant.status == ParticipantStatus.APPROVED.value,
        )
        .options(selectinload(Participant.team))
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_match(
    session: AsyncSession, org_id: uuid.UUID, tid: uuid.UUID, mid: uuid.UUID
) -> Match | None:
    """A single match, verified to belong to `tid` (`Match.tournament_id` is direct)."""
    stmt = (
        select(Match)
        .where(Match.id == mid, Match.organization_id == org_id, Match.tournament_id == tid)
        .options(
            selectinload(Match.participants), selectinload(Match.round), selectinload(Match.group)
        )
    )
    return (await session.execute(stmt)).scalar_one_or_none()
