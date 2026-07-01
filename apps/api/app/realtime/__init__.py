"""Realtime foundation — broadcaster + subscriptions + connections + transport.

Layers, all behind seams so scale is a config swap, not a rewrite:
- ``pubsub`` — the ``PubSub`` port (in-process asyncio broker at MVP; Redis later).
- ``broadcaster`` — app-facing publish/subscribe of ``{type, data}`` envelopes.
- ``connections`` — live-connection accounting.
- ``channels`` — channel naming + authorization (org/user scoped).
- ``transport`` — turns a subscription into a client stream. **SSE** ships now;
  WebSocket / Ably / Pusher are future transports behind the same protocol.

No tournament events are defined here — this is only the plumbing.
"""
