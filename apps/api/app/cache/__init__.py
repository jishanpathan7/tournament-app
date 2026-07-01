"""Cache implementations (the ``Cache`` port) + JSON convenience helpers.

``InMemoryCache`` is the MVP backend (single instance). A ``RedisCache`` slots in
behind the same port when scaling to multiple instances — a config swap in
``app.core.factory.get_cache``, not a refactor. The port speaks ``bytes``;
``get_json``/``set_json`` are thin helpers for the common dict-caching case and
work against any ``Cache`` implementation.
"""

from __future__ import annotations

import json
from typing import Any

from app.core.ports import Cache


async def get_json(cache: Cache, key: str) -> Any | None:
    raw = await cache.get(key)
    return json.loads(raw) if raw is not None else None


async def set_json(cache: Cache, key: str, value: Any, *, ttl: int) -> None:
    await cache.set(key, json.dumps(value, separators=(",", ":")).encode(), ttl=ttl)
