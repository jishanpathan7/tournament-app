"""Metrics hooks — a tiny counter/timing interface, no-op by default.

The app records metrics through ``Metrics`` (e.g. the request middleware counts
requests + records latency). ``NullMetrics`` is the zero-overhead production default;
an OpenTelemetry / StatsD / Prometheus exporter implements the same interface and is
wired via ``factory.get_metrics`` — a config swap, not a code change.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Protocol


class Metrics(Protocol):
    def increment(self, name: str, value: int = 1, **tags: str) -> None: ...

    def timing(self, name: str, ms: float, **tags: str) -> None: ...


class NullMetrics:
    """No-op default — metrics are dropped until a real exporter is wired."""

    def increment(self, name: str, value: int = 1, **tags: str) -> None:
        return None

    def timing(self, name: str, ms: float, **tags: str) -> None:
        return None


class InMemoryMetrics:
    """Process-local aggregation — useful in dev/tests and as a reference impl."""

    def __init__(self) -> None:
        self.counters: dict[str, int] = defaultdict(int)
        self.timings: dict[str, list[float]] = defaultdict(list)

    @staticmethod
    def _key(name: str, tags: dict[str, str]) -> str:
        if not tags:
            return name
        rendered = ",".join(f"{k}={v}" for k, v in sorted(tags.items()))
        return f"{name}|{rendered}"

    def increment(self, name: str, value: int = 1, **tags: str) -> None:
        self.counters[self._key(name, tags)] += value

    def timing(self, name: str, ms: float, **tags: str) -> None:
        self.timings[self._key(name, tags)].append(ms)
