"""Data access for franchise squads."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.enums import RegistrationStatus
from app.db.models import Division, Registration, SportProfile, Squad, SquadMember, Tournament, User

_ACTIVE_REG = {
    RegistrationStatus.SUBMITTED.value,
    RegistrationStatus.WAITLISTED.value,
    RegistrationStatus.APPROVED.value,
}


async def get_tournament(
    session: AsyncSession, org_id: uuid.UUID, tournament_id: uuid.UUID
) -> Tournament | None:
    stmt = select(Tournament).where(
        Tournament.id == tournament_id, Tournament.organization_id == org_id
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_division(
    session: AsyncSession, org_id: uuid.UUID, division_id: uuid.UUID
) -> Division | None:
    stmt = select(Division).where(Division.id == division_id, Division.organization_id == org_id)
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_squads(
    session: AsyncSession, org_id: uuid.UUID, tournament_id: uuid.UUID
) -> Sequence[Squad]:
    stmt = (
        select(Squad)
        .where(Squad.tournament_id == tournament_id, Squad.organization_id == org_id)
        .options(selectinload(Squad.members).selectinload(SquadMember.registration))
        .order_by(Squad.sort_order, Squad.created_at)
    )
    return (await session.execute(stmt)).scalars().all()


async def get_squad(session: AsyncSession, org_id: uuid.UUID, squad_id: uuid.UUID) -> Squad | None:
    stmt = (
        select(Squad)
        .where(Squad.id == squad_id, Squad.organization_id == org_id)
        .options(selectinload(Squad.members).selectinload(SquadMember.registration))
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_eligible_registrations(
    session: AsyncSession,
    org_id: uuid.UUID,
    tournament_id: uuid.UUID,
    *,
    division_id: uuid.UUID | None = None,
) -> Sequence[Registration]:
    stmt = (
        select(Registration)
        .join(Division, Registration.division_id == Division.id)
        .where(
            Division.tournament_id == tournament_id,
            Registration.organization_id == org_id,
            Registration.status.in_(_ACTIVE_REG),
        )
        .order_by(Registration.created_at, Registration.id)
    )
    if division_id is not None:
        stmt = stmt.where(Registration.division_id == division_id)
    return (await session.execute(stmt)).scalars().all()


async def list_divisions(
    session: AsyncSession, org_id: uuid.UUID, tournament_id: uuid.UUID
) -> Sequence[Division]:
    stmt = (
        select(Division)
        .where(Division.tournament_id == tournament_id, Division.organization_id == org_id)
        .order_by(Division.created_at)
    )
    return (await session.execute(stmt)).scalars().all()


async def get_registration(
    session: AsyncSession, org_id: uuid.UUID, registration_id: uuid.UUID
) -> Registration | None:
    stmt = select(Registration).where(
        Registration.id == registration_id, Registration.organization_id == org_id
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_member_by_registration(
    session: AsyncSession, org_id: uuid.UUID, registration_id: uuid.UUID
) -> SquadMember | None:
    stmt = select(SquadMember).where(
        SquadMember.registration_id == registration_id,
        SquadMember.organization_id == org_id,
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def clear_tournament_squad_members(
    session: AsyncSession, org_id: uuid.UUID, tournament_id: uuid.UUID
) -> None:
    squad_ids = select(Squad.id).where(
        Squad.tournament_id == tournament_id, Squad.organization_id == org_id
    )
    await session.execute(
        delete(SquadMember).where(
            SquadMember.squad_id.in_(squad_ids),
            SquadMember.organization_id == org_id,
        )
    )


async def delete_tournament_squads(
    session: AsyncSession, org_id: uuid.UUID, tournament_id: uuid.UUID
) -> None:
    squad_ids = select(Squad.id).where(
        Squad.tournament_id == tournament_id, Squad.organization_id == org_id
    )
    await session.execute(
        delete(SquadMember).where(
            SquadMember.squad_id.in_(squad_ids),
            SquadMember.organization_id == org_id,
        )
    )
    await session.execute(
        delete(Squad).where(Squad.tournament_id == tournament_id, Squad.organization_id == org_id)
    )


async def get_sport_profile(
    session: AsyncSession, sport_profile_id: uuid.UUID
) -> SportProfile | None:
    return await session.get(SportProfile, sport_profile_id)


async def squad_membership_by_registration(
    session: AsyncSession, org_id: uuid.UUID, tournament_id: uuid.UUID
) -> dict[uuid.UUID, uuid.UUID]:
    """Map registration_id → squad_id for all squad members in a tournament."""
    squads = await list_squads(session, org_id, tournament_id)
    out: dict[uuid.UUID, uuid.UUID] = {}
    for squad in squads:
        for member in squad.members:
            out[member.registration_id] = squad.id
    return out


def cross_squad_forbidden_registration_pairs(
    membership: dict[uuid.UUID, uuid.UUID],
    registration_ids: list[uuid.UUID],
) -> list[tuple[uuid.UUID, uuid.UUID]]:
    """Every cross-squad registration pair — used to keep doubles pairs within franchise teams."""
    eligible = [rid for rid in registration_ids if rid in membership]
    pairs: list[tuple[uuid.UUID, uuid.UUID]] = []
    for i, a in enumerate(eligible):
        for b in eligible[i + 1 :]:
            if membership[a] != membership[b]:
                pairs.append((a, b))
    return pairs


async def load_submitter_names(
    session: AsyncSession, user_ids: set[uuid.UUID]
) -> dict[uuid.UUID, str]:
    if not user_ids:
        return {}
    stmt = select(User.id, User.name).where(User.id.in_(user_ids))
    rows = (await session.execute(stmt)).all()
    return {row[0]: row[1] for row in rows}
