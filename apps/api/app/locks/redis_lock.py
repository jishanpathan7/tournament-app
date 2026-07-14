"""Redis-backed distributed Lock — satisfies ``app.core.ports.Lock``.

Uses SET NX EX (atomic compare-and-set). The key is owned by the process that
acquired it; release just DELetes. No fencing tokens — sufficient for preventing
duplicate long-running jobs (draw generation, standings recompute) where the
at-most-once semantic matters more than strict mutual exclusion under failure.
"""

from __future__ import annotations

from redis.asyncio import Redis


class RedisLock:
    """Redis SETNX-based distributed lock. Satisfies ``app.core.ports.Lock``."""

    def __init__(self, url: str) -> None:
        self._client: Redis = Redis.from_url(url, decode_responses=False)

    async def acquire(self, key: str, *, ttl: int) -> bool:
        result = await self._client.set(key, b"1", nx=True, ex=ttl)
        return result is not None

    async def release(self, key: str) -> None:
        await self._client.delete(key)

    async def close(self) -> None:
        await self._client.aclose()
