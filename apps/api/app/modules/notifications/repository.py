"""Data access for notifications (runs under the request's RLS org context)."""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from typing import cast

from sqlalchemy import CursorResult, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.pagination import CursorParams, cursor_page
from app.db.enums import NotificationChannel, NotificationPriority, NotificationStatus
from app.db.models import Notification

_IN_APP = NotificationChannel.IN_APP.value
_READ = NotificationStatus.READ.value
_RESOLVED = NotificationStatus.RESOLVED.value
_ACTION_REQUIRED = NotificationPriority.ACTION_REQUIRED.value

_TERMINAL = (_READ, _RESOLVED)


async def list_in_app(
    session: AsyncSession, *, user_id: uuid.UUID, params: CursorParams, unread_only: bool
) -> tuple[Sequence[Notification], str | None]:
    stmt = select(Notification).where(
        Notification.recipient_user_id == user_id,
        Notification.channel == _IN_APP,
        Notification.status != _RESOLVED,
        Notification.priority != _ACTION_REQUIRED,
    )
    if unread_only:
        stmt = stmt.where(Notification.status.notin_(_TERMINAL))
    return await cursor_page(session, stmt, params, entity=Notification)


async def list_action_required(
    session: AsyncSession, *, user_id: uuid.UUID
) -> Sequence[Notification]:
    stmt = (
        select(Notification)
        .where(
            Notification.recipient_user_id == user_id,
            Notification.channel == _IN_APP,
            Notification.priority == _ACTION_REQUIRED,
            Notification.status != _RESOLVED,
        )
        .order_by(Notification.created_at.desc())
    )
    return (await session.execute(stmt)).scalars().all()


async def action_required_count(session: AsyncSession, *, user_id: uuid.UUID) -> int:
    stmt = select(func.count()).where(
        Notification.recipient_user_id == user_id,
        Notification.channel == _IN_APP,
        Notification.priority == _ACTION_REQUIRED,
        Notification.status != _RESOLVED,
    )
    return int((await session.execute(stmt)).scalar_one())


async def unread_count(session: AsyncSession, *, user_id: uuid.UUID) -> int:
    stmt = select(func.count()).where(
        Notification.recipient_user_id == user_id,
        Notification.channel == _IN_APP,
        Notification.status.notin_(_TERMINAL),
    )
    return int((await session.execute(stmt)).scalar_one())


async def get_for_user(
    session: AsyncSession, *, user_id: uuid.UUID, notification_id: uuid.UUID
) -> Notification | None:
    stmt = select(Notification).where(
        Notification.id == notification_id, Notification.recipient_user_id == user_id
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def find_unresolved(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    type: str,
    dedup_key: str,
) -> Notification | None:
    """Return an existing unresolved IN_APP notification with this type + dedup_key."""
    stmt = (
        select(Notification)
        .where(
            Notification.recipient_user_id == user_id,
            Notification.channel == _IN_APP,
            Notification.type == type,
            Notification.status != _RESOLVED,
            Notification.payload["dedup_key"].as_string() == dedup_key,
        )
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def mark_all_read(session: AsyncSession, *, user_id: uuid.UUID) -> int:
    """Mark all non-action_required in-app notifications as read."""
    stmt = (
        update(Notification)
        .where(
            Notification.recipient_user_id == user_id,
            Notification.channel == _IN_APP,
            Notification.priority != _ACTION_REQUIRED,
            Notification.status.notin_(_TERMINAL),
        )
        .values(status=_READ)
    )
    result = await session.execute(stmt)
    return int(cast(CursorResult, result).rowcount or 0)
