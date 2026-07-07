"""Per-channel delivery — the seam for in-app / email / (future) WhatsApp/Slack/Push.

The dispatch handler looks up a deliverer by the notification's channel. In-app is a
no-op (the stored row *is* the delivery); email renders + sends via the EmailChannel.
Adding WhatsApp/Slack/Push = a new deliverer + ``register_deliverer`` + enum value.

**Email kill switch** — ``EmailDeliverer`` checks the org's ``emails_enabled`` flag
before sending.  This is a defense-in-depth layer; the primary gate is in
``queue_email()``.  Notification rows are not deleted when suppressed — they remain
in-app; only the external email delivery is skipped.
"""

from __future__ import annotations

import logging
from typing import Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.factory import get_email_channel
from app.db.enums import NotificationChannel
from app.db.models import Notification, User
from app.modules.notifications.templates import get_template

logger = logging.getLogger("app.notifications.channels")


class NotificationDeliverer(Protocol):
    async def deliver(self, session: AsyncSession, notification: Notification) -> None: ...


class InAppDeliverer:
    """No external delivery — the stored notification row is the in-app delivery."""

    async def deliver(self, session: AsyncSession, notification: Notification) -> None:
        return None


class EmailDeliverer:
    """Render + send via the EmailChannel, using the type's mapped email template."""

    async def deliver(self, session: AsyncSession, notification: Notification) -> None:
        # Defense-in-depth kill-switch check for notification-based emails.
        if notification.organization_id is not None:
            from app.modules.orgs import repository as org_repo

            org = await org_repo.get_org(session, notification.organization_id)
            if org is not None and not org.emails_enabled:
                logger.debug(
                    "email.skipped_kill_switch_notification",
                    extra={
                        "org_id": str(notification.organization_id),
                        "notification_type": notification.type,
                    },
                )
                return

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
