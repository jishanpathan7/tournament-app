"""In-process TTL cache — the MVP ``Cache`` backend (single instance).

Lazy expiry: entries are evicted on read once past their deadline (no background
sweeper — fine at MVP scale). The clock is injectable so TTL behaviour is
deterministically testable. Not shared across processes — that's what the
``RedisCache`` swap is for when we scale out.
"""

from __future__ import annotations

import time
from collections.abc import Callable


class InMemoryCache:
    """Dict-backed cache. Satisfies ``app.core.ports.Cache``."""

    def __init__(self, *, clock: Callable[[], float] = time.monotonic) -> None:
        self._store: dict[str, tuple[float, bytes]] = {}
        self._clock = clock

    async def get(self, key: str) -> bytes | None:
        item = self._store.get(key)
        if item is None:
            return None
        expires_at, value = item
        if self._clock() >= expires_at:
            self._store.pop(key, None)
            return None
        return value

    async def set(self, key: str, value: bytes, *, ttl: int) -> None:
        self._store[key] = (self._clock() + ttl, value)

    async def delete(self, key: str) -> None:
        self._store.pop(key, None)

    async def clear(self) -> None:
        """Drop everything (not part of the port; handy for tests/admin)."""
        self._store.clear()
