"""The ``notification.dispatch`` job handler — delivers a pending notification.

Loaded by the worker on startup (see ``app/workers/poller.py``). Idempotent:
already-delivered notifications are skipped, so at-least-once retries are safe.
"""

from __future__ import annotations

import datetime
import uuid

from app.db.enums import NotificationChannel, NotificationStatus
from app.db.models import Notification
from app.modules.notifications import events as notif_events
from app.modules.notifications.channels import get_deliverer
from app.workers.registry import JobContext, handler

_DONE = {
    NotificationStatus.SENT.value,
    NotificationStatus.DELIVERED.value,
    NotificationStatus.READ.value,
}


@handler(notif_events.DISPATCH)
async def dispatch_notification(payload: dict, ctx: JobContext) -> None:
    notification = await ctx.session.get(Notification, uuid.UUID(payload["notificationId"]))
    if notification is None or notification.status in _DONE:
        return  # purged or already delivered — idempotent no-op
    deliverer = get_deliverer(NotificationChannel(notification.channel))
    if deliverer is None:
        raise LookupError(f"No deliverer for channel {notification.channel!r}")
    await deliverer.deliver(ctx.session, notification)
    notification.status = NotificationStatus.SENT.value
    notification.sent_at = datetime.datetime.now(datetime.timezone.utc)
