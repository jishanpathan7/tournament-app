"""Transport abstraction — turns an event-envelope stream into a client stream.

``SSETransport`` (Server-Sent Events) is the MVP transport: one-way fan-out, works
on the single instance, no extra deps. WebSocket / Ably / Pusher are future
transports behind the same ``RealtimeTransport`` protocol (a config swap).
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any, Protocol

from sse_starlette.sse import EventSourceResponse, ServerSentEvent
from starlette.responses import Response


def to_sse(event: dict[str, Any]) -> ServerSentEvent:
    return ServerSentEvent(data=json.dumps(event.get("data", {})), event=event.get("type"))


class RealtimeTransport(Protocol):
    name: str

    def response(self, events: AsyncIterator[dict[str, Any]], *, ping: int) -> Response: ...


class SSETransport:
    name = "sse"

    def response(self, events: AsyncIterator[dict[str, Any]], *, ping: int) -> Response:
        async def _stream() -> AsyncIterator[ServerSentEvent]:
            async for event in events:
                yield to_sse(event)

        return EventSourceResponse(_stream(), ping=ping)
