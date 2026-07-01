"""Data access for the auth module — queries on users / auth_sessions / auth_tokens
/ memberships. All NO_RLS tables, so these run on the bare ``get_session``."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.enums import AuthTokenPurpose
from app.db.models import AuthSession, AuthToken, Identity, Membership, User


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    stmt = select(User).where(func.lower(User.email) == email.lower())
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_user_by_id(session: AsyncSession, user_id: uuid.UUID) -> User | None:
    return await session.get(User, user_id)


async def list_memberships(session: AsyncSession, user_id: uuid.UUID) -> Sequence[Membership]:
    stmt = (
        select(Membership)
        .where(Membership.user_id == user_id)
        .options(selectinload(Membership.organization))
        .order_by(Membership.created_at)
    )
    return (await session.execute(stmt)).scalars().all()


async def get_membership(
    session: AsyncSession, user_id: uuid.UUID, org_id: uuid.UUID
) -> Membership | None:
    stmt = select(Membership).where(
        Membership.user_id == user_id, Membership.organization_id == org_id
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_auth_session_by_hash(session: AsyncSession, token_hash: str) -> AuthSession | None:
    stmt = select(AuthSession).where(AuthSession.token_hash == token_hash)
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_active_sessions(session: AsyncSession, user_id: uuid.UUID) -> Sequence[AuthSession]:
    stmt = (
        select(AuthSession)
        .where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
        .order_by(AuthSession.created_at.desc())
    )
    return (await session.execute(stmt)).scalars().all()


async def get_identity(session: AsyncSession, provider: str, subject: str) -> Identity | None:
    stmt = select(Identity).where(
        Identity.provider == provider, Identity.provider_subject == subject
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_active_auth_token(
    session: AsyncSession, token_hash: str, purpose: AuthTokenPurpose
) -> AuthToken | None:
    stmt = select(AuthToken).where(
        AuthToken.token_hash == token_hash,
        AuthToken.purpose == purpose,
        AuthToken.consumed_at.is_(None),
    )
    return (await session.execute(stmt)).scalar_one_or_none()
