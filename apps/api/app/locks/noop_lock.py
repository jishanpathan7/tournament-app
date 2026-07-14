"""No-op Lock — the MVP backend (single instance, no contention).

At single instance a Python asyncio event loop processes one coroutine at a time,
so concurrent draw generation / standings recomputes cannot actually race. This
no-op satisfies the ``Lock`` port so call sites are written once and the ``RedisLock``
slots in behind the factory when horizontal scaling begins.
"""

from __future__ import annotations


class NoopLock:
    """Always grants the lock. Satisfies ``app.core.ports.Lock``."""

    async def acquire(self, key: str, *, ttl: int) -> bool:
        return True

    async def release(self, key: str) -> None:
        pass
