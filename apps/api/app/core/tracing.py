"""Tracing hooks — a ``span`` context manager, no-op by default.

Instrument code with ``with get_tracer().span("name", **attrs): ...``. ``NullTracer``
does nothing; an OpenTelemetry tracer implements the same interface and is wired via
``factory.get_tracer`` when OTel is enabled — prepared for, not required by, MVP.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import AbstractContextManager, contextmanager
from typing import Any, Protocol


class Tracer(Protocol):
    def span(self, name: str, **attrs: Any) -> AbstractContextManager[None]: ...


class NullTracer:
    @contextmanager
    def span(self, name: str, **attrs: Any) -> Iterator[None]:
        yield
