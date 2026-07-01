"""Per-channel delivery — the seam for in-app / email / (future) WhatsApp/Slack/Push.

The dispatch handler looks up a deliverer by the notification's channel. In-app is a
no-op (the stored row *is* the delivery); email renders + sends via the EmailChannel.
Adding WhatsApp/Slack/Push = a new deliverer + ``register_deliverer`` + enum value.
"""

from __future__ import annotations

from typing import Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.factory import get_email_channel
from app.db.enums import NotificationChannel
from app.db.models import Notification, User
from app.modules.notifications.templates import get_template


class NotificationDeliverer(Protocol):
    async def deliver(self, session: AsyncSession, notification: Notification) -> None: ...


class InAppDeliverer:
    """No external delivery — the stored notification row is the in-app delivery."""

    async def deliver(self, session: AsyncSession, notification: Notification) -> None:
        return None


class EmailDeliverer:
    """Render + send via the EmailChannel, using the type's mapped email template."""

    async def deliver(self, session: AsyncSession, notification: Notification) -> None:
        template = get_template(notification.type)
        email_template = template.email_template if template else None
        if not email_template:
            raise ValueError(f"No email template mapped for {notification.type!r}")
        user = await session.get(User, notification.recipient_user_id)
        if user is None:
            raise LookupError("Notification recipient not found")
        data = (notification.payload or {}).get("data", {})
        await get_email_channel().send(user.email, email_template, data)


_DELIVERERS: dict[NotificationChannel, NotificationDeliverer] = {
    NotificationChannel.IN_APP: InAppDeliverer(),
    NotificationChannel.EMAIL: EmailDeliverer(),
}


def get_deliverer(channel: NotificationChannel) -> NotificationDeliverer | None:
    return _DELIVERERS.get(channel)


def register_deliverer(channel: NotificationChannel, deliverer: NotificationDeliverer) -> None:
    """Register a channel deliverer (future WhatsApp/Slack/Push)."""
    _DELIVERERS[channel] = deliverer
