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

from sqlalchemy import delete, or_

from app.core.config import get_settings
from app.core.factory import get_email_channel
from app.db.models import AuthToken, Outbox
from app.workers.registry import JobContext, handler

EMAIL_DELIVER = "email.deliver"
MAINTENANCE_CLEANUP = "maintenance.cleanup"


@handler(EMAIL_DELIVER)
async def deliver_email(payload: dict, ctx: JobContext) -> None:
    channel = get_email_channel()
    await channel.send(payload["to"], payload["template"], payload.get("data", {}))


@handler(MAINTENANCE_CLEANUP)
async def cleanup(payload: dict, ctx: JobContext) -> None:
    now = datetime.datetime.now(datetime.timezone.utc)
    cutoff = now - datetime.timedelta(days=get_settings().outbox_retention_days)
    # NO_RLS tables only — safe without an org context.
    await ctx.session.execute(
        delete(AuthToken).where(or_(AuthToken.expires_at < now, AuthToken.consumed_at.is_not(None)))
    )
    await ctx.session.execute(
        delete(Outbox).where(Outbox.processed_at.is_not(None), Outbox.processed_at < cutoff)
    )
