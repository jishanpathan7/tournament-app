"""Request-context + observability middleware.

Pure ASGI (no BaseHTTPMiddleware overhead). Per request it: assigns/propagates
``X-Request-ID`` (in a contextvar the logging filter + error handlers read), times
the request (``X-Response-Time`` header + a structured ``http.request`` log line),
records request count/latency metrics, and opens a trace span — all through the
no-op-by-default metrics/tracer hooks (real exporters wire in via the factory).
"""

from __future__ import annotations

import logging
import time
import uuid

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.context import request_id_var, set_principal_context
from app.core.factory import get_metrics, get_tracer

REQUEST_ID_HEADER = b"x-request-id"
RESPONSE_TIME_HEADER = b"x-response-time"

logger = logging.getLogger("app.request")


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

        method = scope.get("method", "")
        path = scope.get("path", "")
        start = time.perf_counter()
        status_code = 0

        async def send_wrapper(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = int(message["status"])
                elapsed_ms = (time.perf_counter() - start) * 1000
                raw = list(message.get("headers") or [])
                raw.append((REQUEST_ID_HEADER, request_id.encode()))
                raw.append((RESPONSE_TIME_HEADER, f"{elapsed_ms:.1f}ms".encode()))
                message["headers"] = raw
            await send(message)

        metrics = get_metrics()
        tracer = get_tracer()
        try:
            with tracer.span("http.request", method=method, path=path):
                await self.app(scope, receive, send_wrapper)
        finally:
            elapsed_ms = (time.perf_counter() - start) * 1000
            metrics.increment("http_requests_total", status=str(status_code), method=method)
            metrics.timing("http_request_duration_ms", elapsed_ms, method=method)
            logger.info(
                "http.request",
                extra={
                    "method": method,
                    "path": path,
                    "status": status_code,
                    "durationMs": round(elapsed_ms, 1),
                },
            )
            request_id_var.reset(token)
            set_principal_context(None, None)  # clear principal so it can't leak across requests
