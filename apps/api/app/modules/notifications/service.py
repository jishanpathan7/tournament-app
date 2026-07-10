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
from app.db.enums import NotificationChannel, NotificationPriority, NotificationStatus
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
    dedup_key: str | None = None,
) -> list[Notification]:
    """Create a notification per target channel; enqueue async delivery for non-in-app.

    ``dedup_key`` — when provided, suppresses creation if an unresolved IN_APP
    notification with the same type + dedup_key already exists for this recipient.
    Used by the monitoring worker to avoid re-alerting on the same idle court.
    """
    if dedup_key is not None:
        existing = await repo.find_unresolved(
            session,
            user_id=recipient_user_id,
            type=type,
            dedup_key=dedup_key,
        )
        if existing is not None:
            return []

    template = tmpl.get_template(type)
    resolved = tuple(channels) if channels is not None else _default_channels(template)
    if template is not None:
        title, body = tmpl.render_in_app(template, data)
        priority = template.priority.value
        icon = template.icon
        cta_label = template.cta_label
        cta_href = tmpl.render_cta_href(template, data)
    else:
        title, body = str(data.get("title", type)), str(data.get("body", ""))
        priority = NotificationPriority.INFO.value
        icon = "bell"
        cta_label = None
        cta_href = None

    created: list[Notification] = []
    for channel in resolved:
        is_in_app = channel == NotificationChannel.IN_APP
        payload: dict = {"title": title, "body": body, "data": data}
        if dedup_key is not None:
            payload["dedup_key"] = dedup_key
        notification = Notification(
            organization_id=organization_id,
            recipient_user_id=recipient_user_id,
            type=type,
            channel=channel.value,
            payload=payload,
            status=(NotificationStatus.SENT if is_in_app else NotificationStatus.PENDING).value,
            sent_at=_now() if is_in_app else None,
            priority=priority,
            icon=icon,
            cta_label=cta_label,
            cta_href=cta_href,
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


async def list_action_required(
    session: AsyncSession, *, user_id: uuid.UUID
) -> Sequence[Notification]:
    return await repo.list_action_required(session, user_id=user_id)


async def unread_count(session: AsyncSession, *, user_id: uuid.UUID) -> int:
    """Count of action_required unread notifications only (drives the bell badge)."""
    return await repo.action_required_count(session, user_id=user_id)


async def mark_read(
    session: AsyncSession, *, user_id: uuid.UUID, notification_id: uuid.UUID
) -> Notification:
    notification = await repo.get_for_user(
        session, user_id=user_id, notification_id=notification_id
    )
    if notification is None:
        raise NotFoundError("Notification not found")
    if notification.status not in (NotificationStatus.RESOLVED.value,):
        notification.status = NotificationStatus.READ.value
    await session.flush()
    return notification


async def resolve_notification(
    session: AsyncSession, *, user_id: uuid.UUID, notification_id: uuid.UUID
) -> Notification:
    """Dismiss/resolve an action_required notification."""
    notification = await repo.get_for_user(
        session, user_id=user_id, notification_id=notification_id
    )
    if notification is None:
        raise NotFoundError("Notification not found")
    notification.status = NotificationStatus.RESOLVED.value
    notification.resolved_at = _now()
    await session.flush()
    return notification


async def mark_all_read(session: AsyncSession, *, user_id: uuid.UUID) -> int:
    """Mark all 'important' and 'info' notifications as read (not action_required)."""
    return await repo.mark_all_read(session, user_id=user_id)
