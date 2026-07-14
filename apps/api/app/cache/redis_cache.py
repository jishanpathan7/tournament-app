"""Redis-backed Cache — satisfies ``app.core.ports.Cache``.

Uses ``redis-py`` async client (``redis[asyncio]``). Works against Upstash Redis or any
Redis-compatible endpoint. ``decode_responses=False`` keeps the bytes-in/bytes-out
contract of the port. Close the client in the app lifespan via ``cache.close()`` when
this backend is active (``hasattr(cache, "close")`` guard in lifespan is sufficient).
"""

from __future__ import annotations

from redis.asyncio import Redis


class RedisCache:
    """Async Redis-backed Cache. Satisfies ``app.core.ports.Cache``."""

    def __init__(self, url: str) -> None:
        self._client: Redis = Redis.from_url(url, decode_responses=False)

    async def get(self, key: str) -> bytes | None:
        # redis-py types get() as bytes | str | None depending on decode_responses;
        # decode_responses=False guarantees bytes, so the cast is safe.
        result = await self._client.get(key)
        return result if isinstance(result, bytes) else None

    async def set(self, key: str, value: bytes, *, ttl: int) -> None:
        await self._client.setex(key, ttl, value)

    async def delete(self, key: str) -> None:
        await self._client.delete(key)

    async def delete_many(self, keys: list[str]) -> None:
        if keys:
            await self._client.delete(*keys)

    async def close(self) -> None:
        await self._client.aclose()
