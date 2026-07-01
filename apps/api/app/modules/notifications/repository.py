"""Data access for notifications (runs under the request's RLS org context)."""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from typing import cast

from sqlalchemy import CursorResult, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.pagination import CursorParams, cursor_page
from app.db.enums import NotificationChannel, NotificationStatus
from app.db.models import Notification

_IN_APP = NotificationChannel.IN_APP.value
_READ = NotificationStatus.READ.value


async def list_in_app(
    session: AsyncSession, *, user_id: uuid.UUID, params: CursorParams, unread_only: bool
) -> tuple[Sequence[Notification], str | None]:
    stmt = select(Notification).where(
        Notification.recipient_user_id == user_id, Notification.channel == _IN_APP
    )
    if unread_only:
        stmt = stmt.where(Notification.status != _READ)
    return await cursor_page(session, stmt, params, entity=Notification)


async def unread_count(session: AsyncSession, *, user_id: uuid.UUID) -> int:
    stmt = select(func.count()).where(
        Notification.recipient_user_id == user_id,
        Notification.channel == _IN_APP,
        Notification.status != _READ,
    )
    return int((await session.execute(stmt)).scalar_one())


async def get_for_user(
    session: AsyncSession, *, user_id: uuid.UUID, notification_id: uuid.UUID
) -> Notification | None:
    stmt = select(Notification).where(
        Notification.id == notification_id, Notification.recipient_user_id == user_id
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def mark_all_read(session: AsyncSession, *, user_id: uuid.UUID) -> int:
    stmt = (
        update(Notification)
        .where(
            Notification.recipient_user_id == user_id,
            Notification.channel == _IN_APP,
            Notification.status != _READ,
        )
        .values(status=_READ)
    )
    result = await session.execute(stmt)
    return int(cast(CursorResult, result).rowcount or 0)
