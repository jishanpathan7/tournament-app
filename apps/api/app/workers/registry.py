"""Job handler registry — maps an outbox ``event_type`` to an async handler.

Transport-agnostic: the same registry is driven by the in-process poller now and
by ARQ/Celery later. Modules register their handlers at import time (via the
``@handler`` decorator); the poller loads the built-in handlers on startup.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession


@dataclass
class JobContext:
    """What a handler receives: the transactional session (org context already set
    when the event payload carries ``organizationId``) plus the event identity."""

    session: AsyncSession
    event_type: str
    event_id: str


Handler = Callable[[dict, JobContext], Awaitable[None]]

_HANDLERS: dict[str, Handler] = {}


def register(event_type: str, fn: Handler) -> None:
    if event_type in _HANDLERS:
        raise ValueError(f"Duplicate job handler for {event_type!r}")
    _HANDLERS[event_type] = fn


def handler(event_type: str) -> Callable[[Handler], Handler]:
    """Decorator: register ``fn`` as the handler for ``event_type``."""

    def decorate(fn: Handler) -> Handler:
        register(event_type, fn)
        return fn

    return decorate


def unregister(event_type: str) -> None:
    _HANDLERS.pop(event_type, None)


def get_handler(event_type: str) -> Handler | None:
    return _HANDLERS.get(event_type)


def registered_event_types() -> frozenset[str]:
    return frozenset(_HANDLERS)
