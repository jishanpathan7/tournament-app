"""Lightweight timing instrumentation for bulk operations.

Usage:
    async with timed("step_name", logger, extra={"count": n}) as t:
        ...  # work
    # Logs: {"event": "perf.step_name", "elapsed_ms": 42.3, "count": n}

The context manager logs elapsed wall time at DEBUG level so it's a no-op in
production log viewers that filter to INFO, but visible when LOG_LEVEL=DEBUG.
"""

from __future__ import annotations

import logging
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any


@asynccontextmanager
async def timed(
    event: str,
    logger: logging.Logger,
    *,
    extra: dict[str, Any] | None = None,
) -> AsyncIterator[None]:
    start = time.monotonic()
    try:
        yield
    finally:
        elapsed_ms = round((time.monotonic() - start) * 1000, 1)
        logger.debug(
            f"perf.{event}",
            extra={"elapsed_ms": elapsed_ms, **(extra or {})},
        )
