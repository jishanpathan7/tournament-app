"""Realtime foundation tests: in-process pub/sub, broadcaster envelopes, connection
accounting, SSE formatting, and the SSE endpoint's auth/authz + stream headers."""

from __future__ import annotations

import asyncio
import os
import secrets
import uuid

import pytest

from app.api.deps import Principal
from app.api.errors import PermissionDeniedError
from app.db.enums import OrgRole
from app.realtime.broadcaster import Broadcaster
from app.realtime.channels import org_channel
from app.realtime.connections import ConnectionManager
from app.realtime.pubsub import InProcessPubSub
from app.realtime.router import stream
from app.realtime.transport import to_sse

DATABASE_URL = os.environ.get("DATABASE_URL")

PASSWORD = secrets.token_urlsafe(16)
AUTH = "/api/v1/auth"
ORGS = "/api/v1/orgs"
RT = "/api/v1/realtime"


# ---- unit: pub/sub, broadcaster, connections, transport (no DB) ----


async def test_pubsub_delivers_and_cleans_up():
    ps = InProcessPubSub()
    gen = ps.subscribe("c1")
    task = asyncio.create_task(gen.__anext__())
    await asyncio.sleep(0.05)  # let the subscriber register its queue
    assert ps.subscriber_count("c1") == 1
    await ps.publish("c1", {"type": "t", "data": {"n": 1}})
    assert await asyncio.wait_for(task, timeout=2) == {"type": "t", "data": {"n": 1}}
    await gen.aclose()
    assert ps.subscriber_count("c1") == 0


async def test_pubsub_fans_out_to_all_subscribers():
    ps = InProcessPubSub()
    g1, g2 = ps.subscribe("c"), ps.subscribe("c")
    t1, t2 = asyncio.create_task(g1.__anext__()), asyncio.create_task(g2.__anext__())
    await asyncio.sleep(0.05)
    await ps.publish("c", {"type": "x", "data": {}})
    assert await asyncio.wait_for(t1, 2) == {"type": "x", "data": {}}
    assert await asyncio.wait_for(t2, 2) == {"type": "x", "data": {}}
    await g1.aclose()
    await g2.aclose()


async def test_broadcaster_wraps_envelope():
    broadcaster = Broadcaster(InProcessPubSub())
    gen = broadcaster.subscribe("c")
    task = asyncio.create_task(gen.__anext__())
    await asyncio.sleep(0.05)
    await broadcaster.publish("c", "ping", {"n": 1})
    assert await asyncio.wait_for(task, 2) == {"type": "ping", "data": {"n": 1}}
    await gen.aclose()


def test_connection_manager_tracks_counts():
    cm = ConnectionManager()
    with cm.track("c"):
        assert cm.count("c") == 1 and cm.total == 1
        with cm.track("c"):
            assert cm.count("c") == 2 and cm.total == 2
        assert cm.count("c") == 1
    assert cm.count("c") == 0 and cm.total == 0


def test_to_sse_formats_event_and_type():
    sse = to_sse({"type": "ping", "data": {"n": 1}})
    assert sse.event == "ping"
    assert '"n": 1' in sse.data


# ---- endpoint: auth / authz / stream headers (DB-backed) ----

_db = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not set")


def _csrf(client) -> dict[str, str]:
    return {"X-CSRF-Token": client.cookies.get("csrf_token") or ""}


async def _auth_and_org(client) -> str:
    email = f"u-{uuid.uuid4().hex[:12]}@example.com"
    await client.post(f"{AUTH}/register", json={"email": email, "name": "T", "password": PASSWORD})
    await client.post(f"{AUTH}/login", json={"email": email, "password": PASSWORD})
    org = await client.post(
        ORGS, json={"name": "Acme", "slug": f"org-{uuid.uuid4().hex[:10]}"}, headers=_csrf(client)
    )
    return org.json()["activeOrganizationId"]


@_db
async def test_stream_requires_auth(app, client):
    assert (await client.get(f"{RT}/stream?channel=org:x")).status_code == 401


@_db
async def test_stream_rejects_unauthorized_channel(app, client):
    await _auth_and_org(client)
    foreign = f"org:{uuid.uuid4()}"
    assert (await client.get(f"{RT}/stream?channel={foreign}")).status_code == 403


async def test_stream_handler_returns_sse_response():
    # Call the handler directly: it returns an SSE response without opening an
    # infinite stream (the event generator is never consumed here). Testing the
    # live stream over HTTP is avoided — an infinite EventSourceResponse doesn't
    # tear down cleanly under the shared test loop and hangs the suite.
    org = uuid.uuid4()
    principal = Principal(user_id=uuid.uuid4(), organization_id=org, org_role=OrgRole.OWNER)
    response = await stream(channel=org_channel(org), principal=principal)
    assert response.media_type == "text/event-stream"


async def test_stream_handler_rejects_foreign_channel():
    principal = Principal(
        user_id=uuid.uuid4(), organization_id=uuid.uuid4(), org_role=OrgRole.OWNER
    )
    with pytest.raises(PermissionDeniedError):
        await stream(channel=org_channel(uuid.uuid4()), principal=principal)
