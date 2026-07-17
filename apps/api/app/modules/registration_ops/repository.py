"""Data access for Registration Operations — org-scoped."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    Division,
    MappingTemplate,
    Match,
    Participant,
    Registration,
    Stage,
    Team,
    Tournament,
    User,
)


async def get_division(session: AsyncSession, org_id: uuid.UUID, did: uuid.UUID) -> Division | None:
    stmt = select(Division).where(Division.id == did, Division.organization_id == org_id)
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_tournament(
    session: AsyncSession, org_id: uuid.UUID, tid: uuid.UUID
) -> Tournament | None:
    stmt = select(Tournament).where(Tournament.id == tid, Tournament.organization_id == org_id)
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


async def list_registrations(
    session: AsyncSession, org_id: uuid.UUID, division_id: uuid.UUID
) -> Sequence[Registration]:
    stmt = (
        select(Registration)
        .where(Registration.division_id == division_id, Registration.organization_id == org_id)
        .order_by(Registration.created_at, Registration.id)
    )
    return (await session.execute(stmt)).scalars().all()


async def list_participants(
    session: AsyncSession, org_id: uuid.UUID, division_id: uuid.UUID
) -> Sequence[Participant]:
    stmt = (
        select(Participant)
        .where(Participant.division_id == division_id, Participant.organization_id == org_id)
        .order_by(Participant.display_name)
    )
    return (await session.execute(stmt)).scalars().all()


async def list_tournament_participants(
    session: AsyncSession, org_id: uuid.UUID, tid: uuid.UUID
) -> Sequence[Participant]:
    """Every participant across the tournament's divisions — for the readiness roll-up."""
    stmt = (
        select(Participant)
        .join(Division, Participant.division_id == Division.id)
        .where(Division.tournament_id == tid, Participant.organization_id == org_id)
        .options(selectinload(Participant.team))
    )
    return (await session.execute(stmt)).scalars().all()


async def get_participant(
    session: AsyncSession, org_id: uuid.UUID, pid: uuid.UUID
) -> Participant | None:
    stmt = select(Participant).where(Participant.id == pid, Participant.organization_id == org_id)
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_participants(
    session: AsyncSession, org_id: uuid.UUID, ids: Sequence[uuid.UUID]
) -> Sequence[Participant]:
    if not ids:
        return []
    stmt = select(Participant).where(
        Participant.organization_id == org_id, Participant.id.in_(list(ids))
    )
    return (await session.execute(stmt)).scalars().all()


async def divisions_drawn(
    session: AsyncSession, org_id: uuid.UUID, tid: uuid.UUID
) -> set[uuid.UUID]:
    """Division ids in the tournament that have at least one match (i.e. a draw exists)."""
    stmt = (
        select(Stage.division_id)
        .join(Match, Match.stage_id == Stage.id)
        .join(Division, Stage.division_id == Division.id)
        .where(Division.tournament_id == tid, Stage.organization_id == org_id)
        .group_by(Stage.division_id)
    )
    return {row[0] for row in (await session.execute(stmt)).all()}


async def get_team_with_roster(
    session: AsyncSession, org_id: uuid.UUID, tid: uuid.UUID
) -> Team | None:
    stmt = (
        select(Team)
        .where(Team.id == tid, Team.organization_id == org_id)
        .options(selectinload(Team.roster_entries))
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_user(session: AsyncSession, uid: uuid.UUID) -> User | None:
    return await session.get(User, uid)


# ---- mapping templates ----


async def list_mapping_templates(
    session: AsyncSession, org_id: uuid.UUID, source: str | None
) -> Sequence[MappingTemplate]:
    stmt = select(MappingTemplate).where(MappingTemplate.organization_id == org_id)
    if source is not None:
        stmt = stmt.where(MappingTemplate.source == source)
    stmt = stmt.order_by(MappingTemplate.name)
    return (await session.execute(stmt)).scalars().all()


async def get_mapping_template_by_name(
    session: AsyncSession, org_id: uuid.UUID, name: str
) -> MappingTemplate | None:
    stmt = select(MappingTemplate).where(
        MappingTemplate.organization_id == org_id, MappingTemplate.name == name
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_mapping_template(
    session: AsyncSession, org_id: uuid.UUID, tid: uuid.UUID
) -> MappingTemplate | None:
    stmt = select(MappingTemplate).where(
        MappingTemplate.id == tid, MappingTemplate.organization_id == org_id
    )
    return (await session.execute(stmt)).scalar_one_or_none()
