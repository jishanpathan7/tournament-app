"""In-process pub/sub — the MVP ``PubSub`` backend (single instance).

Each subscriber gets a bounded queue; ``publish`` fans an event out to every
subscriber on the channel, dropping for a subscriber whose buffer is full (realtime
is best-effort — a slow client must not block publishers). A ``RedisPubSub`` drops
in behind the same port for cross-instance fan-out when scaling out.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from typing import Any


class InProcessPubSub:
    """Satisfies ``app.core.ports.PubSub``."""

    def __init__(self, *, max_queue: int = 100) -> None:
        self._subscribers: dict[str, set[asyncio.Queue[dict[str, Any]]]] = {}
        self._max_queue = max_queue

    async def publish(self, channel: str, event: dict[str, Any]) -> None:
        for queue in list(self._subscribers.get(channel, ())):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                pass  # drop for a slow subscriber; realtime is best-effort

    async def subscribe(self, channel: str) -> AsyncIterator[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=self._max_queue)
        self._subscribers.setdefault(channel, set()).add(queue)
        try:
            while True:
                yield await queue.get()
        finally:
            subscribers = self._subscribers.get(channel)
            if subscribers is not None:
                subscribers.discard(queue)
                if not subscribers:
                    self._subscribers.pop(channel, None)

    def subscriber_count(self, channel: str) -> int:
        return len(self._subscribers.get(channel, ()))
