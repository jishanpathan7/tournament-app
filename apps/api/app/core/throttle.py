"""In-process login throttle (brute-force guard).

A per-key sliding window over an in-memory deque — single-instance only, which
matches the MVP "in-process" decision (docs/INTERFACES.md). Swap for a Redis-backed
``LoginThrottle`` at scale. ``check`` raises ``LoginThrottleError``; the auth service
maps that to a 429.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque

from app.core.config import Settings, get_settings


class LoginThrottleError(Exception):
    """Too many recent failed attempts for a key."""


class InMemoryThrottle:
    def __init__(self, *, max_attempts: int, window_seconds: int) -> None:
        self._max = max_attempts
        self._window = window_seconds
        self._failures: dict[str, deque[float]] = defaultdict(deque)

    def _prune(self, key: str, now: float) -> None:
        window = self._failures[key]
        while window and now - window[0] > self._window:
            window.popleft()

    async def check(self, key: str) -> None:
        now = time.monotonic()
        self._prune(key, now)
        if len(self._failures[key]) >= self._max:
            raise LoginThrottleError(key)

    async def record_failure(self, key: str) -> None:
        now = time.monotonic()
        self._prune(key, now)
        self._failures[key].append(now)

    async def reset(self, key: str) -> None:
        self._failures.pop(key, None)


def build_throttle(settings: Settings | None = None) -> InMemoryThrottle:
    settings = settings or get_settings()
    return InMemoryThrottle(
        max_attempts=settings.login_max_attempts, window_seconds=settings.login_attempt_window
    )
