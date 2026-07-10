"""Database access for tournament_members and tournament_invites."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.db.models import TournamentInvite, TournamentMember, User


async def get_member(
    session: AsyncSession, tournament_id: uuid.UUID, user_id: uuid.UUID
) -> TournamentMember | None:
    result = await session.execute(
        select(TournamentMember)
        .where(
            TournamentMember.tournament_id == tournament_id,
            TournamentMember.user_id == user_id,
        )
        .options(joinedload(TournamentMember.user))
    )
    return result.scalar_one_or_none()


async def list_members(session: AsyncSession, tournament_id: uuid.UUID) -> list[TournamentMember]:
    result = await session.execute(
        select(TournamentMember)
        .where(TournamentMember.tournament_id == tournament_id)
        .options(joinedload(TournamentMember.user))
        .order_by(TournamentMember.created_at)
    )
    return list(result.scalars().all())


async def get_invite_by_token_hash(
    session: AsyncSession, token_hash: str
) -> TournamentInvite | None:
    result = await session.execute(
        select(TournamentInvite).where(TournamentInvite.token_hash == token_hash)
    )
    return result.scalar_one_or_none()


async def get_pending_invite(
    session: AsyncSession, tournament_id: uuid.UUID, email: str
) -> TournamentInvite | None:
    result = await session.execute(
        select(TournamentInvite).where(
            TournamentInvite.tournament_id == tournament_id,
            TournamentInvite.email == email.lower(),
            TournamentInvite.status == "pending",
        )
    )
    return result.scalar_one_or_none()


async def list_pending_invites(
    session: AsyncSession, tournament_id: uuid.UUID
) -> list[TournamentInvite]:
    result = await session.execute(
        select(TournamentInvite)
        .where(
            TournamentInvite.tournament_id == tournament_id,
            TournamentInvite.status == "pending",
        )
        .order_by(TournamentInvite.created_at)
    )
    return list(result.scalars().all())


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    from sqlalchemy import func

    result = await session.execute(select(User).where(func.lower(User.email) == email.lower()))
    return result.scalar_one_or_none()
