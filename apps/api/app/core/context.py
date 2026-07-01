"""Request-scoped context via contextvars.

`request_id` is set by ``app.api.middleware.RequestContextMiddleware``; `user_id`
and `org_id` are set by ``app.api.auth_context.get_current_user`` once the request
is authenticated. The logging filter (``app.core.logging``) and error handlers read
all three, so every log line and Problem Detail can be correlated to a request and
(when known) a principal.
"""

from __future__ import annotations

import contextvars
import uuid

request_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "request_id", default=None
)
user_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar("user_id", default=None)
org_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar("org_id", default=None)


def get_request_id() -> str | None:
    return request_id_var.get()


def get_user_id() -> str | None:
    return user_id_var.get()


def get_org_id() -> str | None:
    return org_id_var.get()


def set_principal_context(
    user_id: uuid.UUID | str | None, organization_id: uuid.UUID | str | None
) -> None:
    user_id_var.set(str(user_id) if user_id is not None else None)
    org_id_var.set(str(organization_id) if organization_id is not None else None)
