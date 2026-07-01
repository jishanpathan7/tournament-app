"""Unit tests for the in-process cache and JSON helpers (no DB)."""

from __future__ import annotations

from app.cache import get_json, set_json
from app.cache.memory import InMemoryCache


async def test_set_get_delete():
    cache = InMemoryCache()
    assert await cache.get("missing") is None
    await cache.set("k", b"v", ttl=60)
    assert await cache.get("k") == b"v"
    await cache.delete("k")
    assert await cache.get("k") is None


async def test_ttl_expiry_with_injected_clock():
    now = {"t": 1000.0}
    cache = InMemoryCache(clock=lambda: now["t"])
    await cache.set("k", b"v", ttl=10)
    assert await cache.get("k") == b"v"
    now["t"] = 1010.0  # reach the deadline → expired and lazily evicted
    assert await cache.get("k") is None


async def test_clear():
    cache = InMemoryCache()
    await cache.set("a", b"1", ttl=60)
    await cache.set("b", b"2", ttl=60)
    await cache.clear()
    assert await cache.get("a") is None and await cache.get("b") is None


async def test_json_helpers_roundtrip():
    cache = InMemoryCache()
    assert await get_json(cache, "k") is None
    await set_json(cache, "k", {"x": 1, "y": [1, 2, 3]}, ttl=60)
    assert await get_json(cache, "k") == {"x": 1, "y": [1, 2, 3]}
