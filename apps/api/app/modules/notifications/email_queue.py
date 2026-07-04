"""Direct transactional email enqueue — for recipients without a user account.

Registered notification types fan out via ``notify()`` (in-app + email to a user row).
Imported/self-service entrants often only have ``form_response.email``; this helper
queues ``email.deliver`` on the same outbox transaction as the business write.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.events import emit_event
from app.workers.tasks import EMAIL_DELIVER


async def queue_email(
    session: AsyncSession,
    *,
    to: str,
    template: str,
    data: dict[str, Any],
    organization_id: uuid.UUID | None = None,
) -> None:
    payload: dict[str, Any] = {"to": to.strip(), "template": template, "data": data}
    if organization_id is not None:
        payload["organizationId"] = str(organization_id)
    await emit_event(session, aggregate="email", event_type=EMAIL_DELIVER, payload=payload)
