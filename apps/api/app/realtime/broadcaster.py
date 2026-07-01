"""Broadcaster — the app-facing publish/subscribe API over the ``PubSub`` port.

Producers call ``publish(channel, event_type, data)``; the broadcaster wraps it in a
``{type, data}`` envelope so every subscriber (and every transport) sees a uniform
shape. ``subscribe`` returns the raw envelope stream for a transport to deliver.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from app.core.ports import PubSub


class Broadcaster:
    def __init__(self, pubsub: PubSub) -> None:
        self._pubsub = pubsub

    async def publish(self, channel: str, event_type: str, data: dict[str, Any]) -> None:
        await self._pubsub.publish(channel, {"type": event_type, "data": data})

    def subscribe(self, channel: str) -> AsyncIterator[dict[str, Any]]:
        return self._pubsub.subscribe(channel)
