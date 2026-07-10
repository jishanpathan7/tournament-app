"""Built-in, sport-agnostic job handlers (loaded by the poller on startup).

- ``email.deliver`` — send a templated email via the EmailChannel (lets producers
  offload email off the request path).
- ``maintenance.cleanup`` — purge expired NO_RLS rows (auth tokens, old processed
  outbox) safely without an org context.

Reserved task names other modules register their own handlers for (kept here as
documentation, not implemented): ``notification.dispatch`` (Part 5),
``standings.recompute`` / ``export.generate`` (tournament modules).
"""

from __future__ import annotations

import datetime
import logging
import uuid

from sqlalchemy import delete, or_

from app.core.config import get_settings
from app.core.factory import get_email_channel
from app.db.models import AuthToken, Notification, Outbox
from app.workers.registry import JobContext, handler

EMAIL_DELIVER = "email.deliver"
MAINTENANCE_CLEANUP = "maintenance.cleanup"

logger = logging.getLogger("app.workers.tasks")


@handler(EMAIL_DELIVER)
async def deliver_email(payload: dict, ctx: JobContext) -> None:
    # Defense-in-depth kill-switch check.  The primary gate fires at queue_email() time,
    # so this normally never trips — but it protects against events queued before the
    # setting was disabled or events written via any path that bypassed queue_email().
    org_id_str = payload.get("organizationId")
    if org_id_str:
        from app.modules.orgs import repository as org_repo

        org = await org_repo.get_org(ctx.session, uuid.UUID(org_id_str))
        if org is not None and not org.emails_enabled:
            logger.info(
                "email.skipped_kill_switch_worker",
                extra={"org_id": org_id_str, "template": payload.get("template")},
            )
            return

    channel = get_email_channel()
    await channel.send(payload["to"], payload["template"], payload.get("data", {}))


@handler(MAINTENANCE_CLEANUP)
async def cleanup(payload: dict, ctx: JobContext) -> None:
    now = datetime.datetime.now(datetime.timezone.utc)
    settings = get_settings()
    outbox_cutoff = now - datetime.timedelta(days=settings.outbox_retention_days)
    notif_cutoff = now - datetime.timedelta(days=settings.notification_archive_days)
    # NO_RLS tables only — safe without an org context.
    await ctx.session.execute(
        delete(AuthToken).where(or_(AuthToken.expires_at < now, AuthToken.consumed_at.is_not(None)))
    )
    await ctx.session.execute(
        delete(Outbox).where(Outbox.processed_at.is_not(None), Outbox.processed_at < outbox_cutoff)
    )
    # Purge old important/info notifications — action_required kept until resolved.
    await ctx.session.execute(
        delete(Notification).where(
            Notification.priority.in_(["important", "info"]),
            Notification.created_at < notif_cutoff,
        )
    )
