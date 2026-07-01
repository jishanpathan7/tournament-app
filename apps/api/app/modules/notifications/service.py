"""Notification use cases.

``notify`` is the producer API other modules call (on the request session, so it
commits with the business write). In-app notifications are stored immediately
(status=sent); other channels are created pending and an outbox ``notification.dispatch``
event is emitted for the worker to deliver. The service never commits.
"""

from __future__ import annotations

import datetime
import uuid
from collections.abc import Iterable, Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import NotFoundError
from app.api.pagination import CursorParams
from app.core.events import emit_event
from app.db.enums import NotificationChannel, NotificationStatus
from app.db.models import Notification
from app.modules.notifications import events as notif_events
from app.modules.notifications import repository as repo
from app.modules.notifications import templates as tmpl


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


async def notify(
    session: AsyncSession,
    *,
    organization_id: uuid.UUID,
    recipient_user_id: uuid.UUID,
    type: str,
    data: dict,
    channels: Iterable[NotificationChannel] | None = None,
) -> list[Notification]:
    """Create a notification per target channel; enqueue async delivery for non-in-app."""
    template = tmpl.get_template(type)
    resolved = tuple(channels) if channels is not None else _default_channels(template)
    if template is not None:
        title, body = tmpl.render_in_app(template, data)
    else:  # unregistered type → plain in-app notification from the data
        title, body = str(data.get("title", type)), str(data.get("body", ""))

    created: list[Notification] = []
    for channel in resolved:
        is_in_app = channel == NotificationChannel.IN_APP
        notification = Notification(
            organization_id=organization_id,
            recipient_user_id=recipient_user_id,
            type=type,
            channel=channel.value,
            payload={"title": title, "body": body, "data": data},
            status=(NotificationStatus.SENT if is_in_app else NotificationStatus.PENDING).value,
            sent_at=_now() if is_in_app else None,
        )
        session.add(notification)
        await session.flush()
        created.append(notification)
        if not is_in_app:
            await emit_event(
                session,
                aggregate=notif_events.AGGREGATE,
                event_type=notif_events.DISPATCH,
                payload={
                    "notificationId": str(notification.id),
                    "organizationId": str(organization_id),
                },
            )
    return created


def _default_channels(
    template: tmpl.NotificationTemplate | None,
) -> tuple[NotificationChannel, ...]:
    return template.channels if template else (NotificationChannel.IN_APP,)


async def list_for_user(
    session: AsyncSession, *, user_id: uuid.UUID, params: CursorParams, unread_only: bool
) -> tuple[Sequence[Notification], str | None]:
    return await repo.list_in_app(session, user_id=user_id, params=params, unread_only=unread_only)


async def unread_count(session: AsyncSession, *, user_id: uuid.UUID) -> int:
    return await repo.unread_count(session, user_id=user_id)


async def mark_read(
    session: AsyncSession, *, user_id: uuid.UUID, notification_id: uuid.UUID
) -> Notification:
    notification = await repo.get_for_user(
        session, user_id=user_id, notification_id=notification_id
    )
    if notification is None:
        raise NotFoundError("Notification not found")
    notification.status = NotificationStatus.READ.value
    await session.flush()
    return notification


async def mark_all_read(session: AsyncSession, *, user_id: uuid.UUID) -> int:
    return await repo.mark_all_read(session, user_id=user_id)
