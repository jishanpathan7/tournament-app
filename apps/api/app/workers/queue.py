"""``JobQueue`` port implementation backed by the transactional outbox.

``enqueue`` appends a ``job`` outbox row in its own transaction (fire-and-forget,
e.g. scheduling a cleanup). Work tied to a business write should instead use
``app.core.events.emit_event`` on the request session so it commits atomically.
Both land in the same outbox and are drained by the same poller.
"""

from __future__ import annotations

from typing import Any

from app.core.db import session_scope
from app.db.models import Outbox


class OutboxJobQueue:
    """Satisfies ``app.core.ports.JobQueue``."""

    async def enqueue(self, task: str, payload: dict[str, Any]) -> str:
        async with session_scope() as session:
            async with session.begin():
                row = Outbox(aggregate="job", event_type=task, payload=payload)
                session.add(row)
                await session.flush()
                return str(row.id)
