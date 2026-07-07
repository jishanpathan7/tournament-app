"""Direct transactional email enqueue — for recipients without a user account.

Registered notification types fan out via ``notify()`` (in-app + email to a user row).
Imported/self-service entrants often only have ``form_response.email``; this helper
queues ``email.deliver`` on the same outbox transaction as the business write.

**Email kill switch** — when ``organization_id`` is provided, the org's
``emails_enabled`` flag is checked *before* the outbox event is written.  A disabled
org silently skips the enqueue so nothing lands in the outbox and no delivery is
attempted.  Auth emails (verify_email, password_reset) never pass ``organization_id``,
so they are always delivered regardless of this setting.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.events import emit_event
from app.workers.tasks import EMAIL_DELIVER

logger = logging.getLogger("app.email_queue")


async def queue_email(
    session: AsyncSession,
    *,
    to: str,
    template: str,
    data: dict[str, Any],
    organization_id: uuid.UUID | None = None,
) -> None:
    # Primary kill-switch gate.  Import here to avoid a top-level circular dependency
    # (orgs.repository → db.models → identity, which is loaded before notifications).
    if organization_id is not None:
        from app.modules.orgs import repository as org_repo

        org = await org_repo.get_org(session, organization_id)
        if org is not None and not org.emails_enabled:
            logger.debug(
                "email.skipped_kill_switch",
                extra={"org_id": str(organization_id), "template": template, "to": to},
            )
            return

    payload: dict[str, Any] = {"to": to.strip(), "template": template, "data": data}
    if organization_id is not None:
        payload["organizationId"] = str(organization_id)
    await emit_event(session, aggregate="email", event_type=EMAIL_DELIVER, payload=payload)
