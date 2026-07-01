"""Outbox poller — the in-process job consumer.

Claims the oldest unprocessed rows with ``FOR UPDATE SKIP LOCKED`` (safe if more
than one poller ever runs), dispatches each to its registered handler inside a
SAVEPOINT so a handler failure rolls back its writes but not the attempt
bookkeeping, and orders by ``(attempts, id)`` so a poison row sinks behind fresh
work instead of blocking the queue. Handlers should be idempotent (at-least-once).
"""

from __future__ import annotations

import asyncio
import datetime
import logging
from typing import Any

from sqlalchemy import select

from app.core.config import get_settings
from app.core.db import session_scope
from app.db.models import Outbox
from app.db.session import set_org_context
from app.workers.registry import JobContext, get_handler

logger = logging.getLogger("app.worker")

# Modules whose import registers job handlers (via @handler). The standalone worker
# imports these on startup so every handler is present without the API's router graph.
_HANDLER_MODULES = (
    "app.workers.tasks",
    "app.modules.notifications.handlers",
    "app.modules.scoring.handlers",
)

_handlers_loaded = False


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def load_handlers() -> None:
    """Import handler modules so they self-register (idempotent)."""
    global _handlers_loaded
    if _handlers_loaded:
        return
    import importlib

    for module in _HANDLER_MODULES:
        importlib.import_module(module)
    _handlers_loaded = True


async def _process_one(*, max_attempts: int) -> bool:
    """Claim + run the oldest unprocessed row. Returns False when none remain."""
    async with session_scope() as session:
        async with session.begin():
            stmt = (
                select(Outbox)
                .where(Outbox.processed_at.is_(None))
                .order_by(Outbox.attempts, Outbox.id)
                .limit(1)
                .with_for_update(skip_locked=True)
            )
            row = (await session.execute(stmt)).scalars().first()
            if row is None:
                return False

            payload: dict[str, Any] = row.payload or {}
            org_id = payload.get("organizationId")
            if org_id:
                await set_org_context(session, org_id)  # RLS scope for tenant handlers
            ctx = JobContext(session=session, event_type=row.event_type, event_id=str(row.id))
            try:
                handler = get_handler(row.event_type)
                if handler is None:
                    raise LookupError(f"No handler registered for {row.event_type!r}")
                async with session.begin_nested():  # savepoint: undo handler writes on failure
                    await handler(payload, ctx)
                row.processed_at = _now()
                logger.info(
                    "job.processed", extra={"eventType": row.event_type, "eventId": str(row.id)}
                )
            except Exception as exc:  # a handler error must never kill the poller
                row.attempts += 1
                row.last_error = str(exc)[:2000]
                dead = row.attempts >= max_attempts
                if dead:
                    row.processed_at = _now()  # dead-letter: stop retrying, keep last_error
                logger.warning(
                    "job.failed",
                    extra={
                        "eventType": row.event_type,
                        "eventId": str(row.id),
                        "attempts": row.attempts,
                        "deadLettered": dead,
                        "error": str(exc),
                    },
                )
            return True


async def process_pending(*, batch_size: int, max_attempts: int) -> int:
    """Drain up to ``batch_size`` rows, each in its own transaction. Returns count."""
    load_handlers()
    handled = 0
    for _ in range(batch_size):
        if not await _process_one(max_attempts=max_attempts):
            break
        handled += 1
    return handled


async def run_forever(stop: asyncio.Event) -> None:
    """Poll until ``stop`` is set. Sleeps ``worker_poll_interval`` only when idle."""
    settings = get_settings()
    load_handlers()
    logger.info("worker.started", extra={"pollInterval": settings.worker_poll_interval})
    while not stop.is_set():
        try:
            handled = await process_pending(
                batch_size=settings.worker_batch_size, max_attempts=settings.worker_max_attempts
            )
        except Exception:  # keep the loop alive across transient DB errors
            logger.exception("worker.batch_error")
            handled = 0
        if handled == 0:
            try:
                await asyncio.wait_for(stop.wait(), timeout=settings.worker_poll_interval)
            except asyncio.TimeoutError:
                pass
    logger.info("worker.stopped")


async def run_worker() -> None:
    """Standalone entrypoint (``python -m app.workers``). Runs until cancelled."""
    stop = asyncio.Event()
    try:
        await run_forever(stop)
    except (KeyboardInterrupt, asyncio.CancelledError):
        stop.set()
