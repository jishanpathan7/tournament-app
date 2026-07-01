"""Request-context middleware: a correlation id on every request and log line.

Pure ASGI (no BaseHTTPMiddleware overhead). Reads/generates ``X-Request-ID``,
stashes it in a contextvar (so the logging filter and error handlers see it), and
echoes it on the response.
"""

from __future__ import annotations

import uuid

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.context import request_id_var, set_principal_context

REQUEST_ID_HEADER = b"x-request-id"


class RequestContextMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers") or [])
        incoming = headers.get(REQUEST_ID_HEADER)
        request_id = incoming.decode() if incoming else uuid.uuid4().hex
        token = request_id_var.set(request_id)

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                raw = list(message.get("headers") or [])
                raw.append((REQUEST_ID_HEADER, request_id.encode()))
                message["headers"] = raw
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            request_id_var.reset(token)
            set_principal_context(None, None)  # clear principal so it can't leak across requests
