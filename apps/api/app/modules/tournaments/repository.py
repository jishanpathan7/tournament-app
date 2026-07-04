"""Data access for the tournament domain.

Every query is scoped by ``organization_id`` at the app layer (the outer of the three
tenancy layers — app scoping → policy → RLS), so isolation holds even under a
superuser DB connection where RLS is bypassed.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.enums import ParticipantStatus
from app.db.models import (
    AuditLog,
    Division,
    Group,
    Match,
    MatchResultEvent,
    Participant,
    Round,
    SportProfile,
    Stage,
    Standing,
    Tournament,
)


def _not_deleted() -> Any:
    return Tournament.deleted_at.is_(None)


async def stage_matches_with_participants(
    session: AsyncSession, org_id: uuid.UUID, stage_id: uuid.UUID
) -> Sequence[Match]:
    stmt = (
        select(Match)
        .where(Match.stage_id == stage_id, Match.organization_id == org_id)
        .options(selectinload(Match.participants))
        .order_by(Match.created_at)
    )
    return (await session.execute(stmt)).scalars().all()


async def get_tournament(
    session: AsyncSession, org_id: uuid.UUID, tid: uuid.UUID
) -> Tournament | None:
    stmt = select(Tournament).where(
        Tournament.id == tid,
        Tournament.organization_id == org_id,
        _not_deleted(),
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_tournament_by_slug(
    session: AsyncSession, org_id: uuid.UUID, slug: str
) -> Tournament | None:
    stmt = select(Tournament).where(
        Tournament.slug == slug,
        Tournament.organization_id == org_id,
        _not_deleted(),
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_tournaments(session: AsyncSession, org_id: uuid.UUID) -> Sequence[Tournament]:
    stmt = (
        select(Tournament)
        .where(Tournament.organization_id == org_id, _not_deleted())
        .order_by(Tournament.created_at.desc())
    )
    return (await session.execute(stmt)).scalars().all()


async def get_division(session: AsyncSession, org_id: uuid.UUID, did: uuid.UUID) -> Division | None:
    stmt = select(Division).where(Division.id == did, Division.organization_id == org_id)
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_divisions(
    session: AsyncSession, org_id: uuid.UUID, tid: uuid.UUID
) -> Sequence[Division]:
    stmt = (
        select(Division)
        .where(Division.tournament_id == tid, Division.organization_id == org_id)
        .order_by(Division.created_at)
    )
    return (await session.execute(stmt)).scalars().all()


async def get_stage(session: AsyncSession, org_id: uuid.UUID, sid: uuid.UUID) -> Stage | None:
    stmt = select(Stage).where(Stage.id == sid, Stage.organization_id == org_id)
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_stages(session: AsyncSession, org_id: uuid.UUID, did: uuid.UUID) -> Sequence[Stage]:
    stmt = (
        select(Stage)
        .where(Stage.division_id == did, Stage.organization_id == org_id)
        .order_by(Stage.seq)
    )
    return (await session.execute(stmt)).scalars().all()


async def stage_match_count(session: AsyncSession, org_id: uuid.UUID, sid: uuid.UUID) -> int:
    stmt = select(func.count()).where(Match.stage_id == sid, Match.organization_id == org_id)
    return int((await session.execute(stmt)).scalar_one())


async def stage_has_scored_matches(
    session: AsyncSession, org_id: uuid.UUID, sid: uuid.UUID
) -> bool:
    """True if any match in this stage has a real submitted result. Distinguishes actual
    play from the automatic bye→walkover resolution done at draw time (which never goes
    through ``scoring.service.score_match`` and so never writes a ``MatchResultEvent``) —
    this is exactly what makes it safe to clear an unplayed draw and redraw it."""
    stmt = (
        select(func.count())
        .select_from(MatchResultEvent)
        .join(Match, Match.id == MatchResultEvent.match_id)
        .where(Match.stage_id == sid, Match.organization_id == org_id)
    )
    return int((await session.execute(stmt)).scalar_one()) > 0


async def delete_stage_draw(session: AsyncSession, org_id: uuid.UUID, sid: uuid.UUID) -> None:
    """Delete everything a draw persisted for a stage (Standings, Matches — which cascade
    their MatchParticipant/MatchResultEvent rows —, Rounds, Groups), leaving the Stage
    itself (and its config) intact so it can be redrawn. Caller must have already
    confirmed the stage is safe to clear (see `stage_has_scored_matches`)."""
    await session.execute(
        delete(Standing).where(Standing.stage_id == sid, Standing.organization_id == org_id)
    )
    await session.execute(
        delete(Match).where(Match.stage_id == sid, Match.organization_id == org_id)
    )
    await session.execute(
        delete(Round).where(Round.stage_id == sid, Round.organization_id == org_id)
    )
    await session.execute(
        delete(Group).where(Group.stage_id == sid, Group.organization_id == org_id)
    )


async def approved_participants(
    session: AsyncSession, org_id: uuid.UUID, did: uuid.UUID
) -> Sequence[Participant]:
    """Approved participants for a division, in seed order (seeded first, then by age)."""
    stmt = (
        select(Participant)
        .where(
            Participant.division_id == did,
            Participant.organization_id == org_id,
            Participant.status == ParticipantStatus.APPROVED.value,
        )
        .order_by(Participant.seed.nulls_last(), Participant.created_at)
    )
    return (await session.execute(stmt)).scalars().all()


async def get_sport_profile_by_key(
    session: AsyncSession, org_id: uuid.UUID, key: str
) -> SportProfile | None:
    stmt = select(SportProfile).where(
        SportProfile.key == key, SportProfile.organization_id == org_id
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_sport_profile(session: AsyncSession, pid: uuid.UUID) -> SportProfile | None:
    return await session.get(SportProfile, pid)


async def tournament_activity(
    session: AsyncSession, org_id: uuid.UUID, tid: uuid.UUID, limit: int = 200
) -> Sequence[AuditLog]:
    """Audit trail across a tournament's own record plus every division/stage/match it
    owns — backs the Match Center's tournament-wide activity timeline. ``AuditLog`` has
    no direct ``tournament_id`` (it's polymorphic across entity kinds via `entity` +
    `entity_id`), so this collects the owned entity ids first, then matches any of them."""
    division_ids = (
        (
            await session.execute(
                select(Division.id).where(
                    Division.tournament_id == tid, Division.organization_id == org_id
                )
            )
        )
        .scalars()
        .all()
    )
    stage_ids = (
        (
            await session.execute(
                select(Stage.id)
                .join(Division, Division.id == Stage.division_id)
                .where(Division.tournament_id == tid, Stage.organization_id == org_id)
            )
        )
        .scalars()
        .all()
    )
    match_ids = (
        (
            await session.execute(
                select(Match.id).where(Match.tournament_id == tid, Match.organization_id == org_id)
            )
        )
        .scalars()
        .all()
    )

    conditions = [and_(AuditLog.entity == "tournament", AuditLog.entity_id == tid)]
    if division_ids:
        conditions.append(and_(AuditLog.entity == "division", AuditLog.entity_id.in_(division_ids)))
    if stage_ids:
        conditions.append(and_(AuditLog.entity == "stage", AuditLog.entity_id.in_(stage_ids)))
    if match_ids:
        conditions.append(and_(AuditLog.entity == "match", AuditLog.entity_id.in_(match_ids)))

    stmt = (
        select(AuditLog)
        .where(AuditLog.organization_id == org_id, or_(*conditions))
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )
    return (await session.execute(stmt)).scalars().all()
