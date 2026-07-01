"""Run the outbox poller as a standalone process: ``python -m app.workers``.

Used when scaling the worker onto its own service; the single-instance MVP runs
the same loop inside the API lifespan instead.
"""

from __future__ import annotations

import asyncio

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.workers.poller import run_worker

if __name__ == "__main__":
    configure_logging(get_settings().log_level)
    asyncio.run(run_worker())
