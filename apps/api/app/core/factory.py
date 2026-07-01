"""Wires swappable infra implementations from settings — the free→paid seam.

Used as FastAPI dependencies (``Depends(get_login_throttle)`` etc.). ``lru_cache``
makes each a process singleton (the throttle's sliding window must be shared).
"""

from __future__ import annotations

from functools import lru_cache

from app.core.ports import EmailChannel, LoginThrottle
from app.core.throttle import build_throttle
from app.emails.log_channel import LogEmailChannel


@lru_cache
def get_login_throttle() -> LoginThrottle:
    return build_throttle()


@lru_cache
def get_email_channel() -> EmailChannel:
    # Resend wiring is deferred; LogEmailChannel renders to logs until RESEND_API_KEY is set.
    return LogEmailChannel()
