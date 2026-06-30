"""Request-scoped context via contextvars.

Populated by ``app.api.middleware.RequestContextMiddleware``; read by the logging
filter (``app.core.logging``) and the error handlers so every log line and Problem
Detail can carry a correlation id. (org_id / user_id can be added here when auth lands.)
"""

from __future__ import annotations

import contextvars

request_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "request_id", default=None
)


def get_request_id() -> str | None:
    return request_id_var.get()
