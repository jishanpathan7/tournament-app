"""Live-connection accounting for realtime streams.

Tracks how many clients are connected per channel (and in total) for the lifetime of
each stream, via a context manager the transport wraps the subscription in. Feeds
observability/limits later; kept deliberately simple (process-local counters).
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager


class ConnectionManager:
    def __init__(self) -> None:
        self._counts: dict[str, int] = {}
        self._total = 0

    @contextmanager
    def track(self, channel: str) -> Iterator[None]:
        self._counts[channel] = self._counts.get(channel, 0) + 1
        self._total += 1
        try:
            yield
        finally:
            self._total -= 1
            remaining = self._counts.get(channel, 1) - 1
            if remaining <= 0:
                self._counts.pop(channel, None)
            else:
                self._counts[channel] = remaining

    @property
    def total(self) -> int:
        return self._total

    def count(self, channel: str) -> int:
        return self._counts.get(channel, 0)
