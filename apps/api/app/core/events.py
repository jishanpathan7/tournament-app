"""Domain-event producer — the transactional outbox seam.

Services call ``emit_event`` on the SAME session as their business write, so the
business row and the event commit in one transaction (the outbox guarantee, see
docs/INTERFACES.md). The consumer (an in-process polling loop in app/workers/)
is built later, when there are events to process — building it now would be
premature (no producers yet).
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Outbox


async def emit_event(
    session: AsyncSession,
    *,
    aggregate: str,
    event_type: str,
    payload: dict[str, Any],
) -> uuid.UUID:
    """Append an outbox event within the caller's transaction. Returns the event id."""
    event = Outbox(aggregate=aggregate, event_type=event_type, payload=payload)
    session.add(event)
    await session.flush()
    return event.id
