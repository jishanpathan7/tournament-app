"""Realtime subscription endpoint (SSE at MVP).

``GET /realtime/stream?channel=...`` opens a Server-Sent Events stream of
``{type, data}`` envelopes for an authorized channel. Auth via cookie (``get_principal``);
the channel must be one the caller may listen to (own org/user). No tournament events
are published yet — producers call ``broadcaster.publish`` when features need it.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Depends, Query
from starlette.responses import Response

from app.api.deps import Principal, get_principal
from app.api.errors import PermissionDeniedError
from app.core.config import get_settings
from app.core.factory import get_broadcaster, get_connection_manager, get_transport
from app.realtime.channels import is_authorized

router = APIRouter(prefix="/realtime", tags=["realtime"])


@router.get("/stream")
async def stream(
    channel: str = Query(..., min_length=1, max_length=200),
    principal: Principal = Depends(get_principal),
) -> Response:
    if not is_authorized(channel, org_id=principal.organization_id, user_id=principal.user_id):
        raise PermissionDeniedError("Not permitted to subscribe to this channel")

    broadcaster = get_broadcaster()
    connections = get_connection_manager()
    transport = get_transport()

    async def events() -> AsyncIterator[dict[str, Any]]:
        with connections.track(channel):
            async for event in broadcaster.subscribe(channel):
                yield event

    return transport.response(events(), ping=get_settings().realtime_ping_interval)
