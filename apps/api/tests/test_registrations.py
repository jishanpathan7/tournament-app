"""Registration management surface added for the frontend milestone: form_response
exposed to organizers, GET /teams/{id} (roster), organizer-initiated waitlist, and
realtime broadcast on every registration state change. DB-backed (skips without a DB).
"""

from __future__ import annotations

import asyncio
import os
import secrets
import uuid

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.factory import get_broadcaster, get_email_channel
from app.realtime.channels import org_channel

DATABASE_URL = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not set")

PASSWORD = secrets.token_urlsafe(16)
AUTH = "/api/v1/auth"
ORGS = "/api/v1/orgs"
TOUR = "/api/v1/tournaments"


def _email() -> str:
    return f"u-{uuid.uuid4().hex[:12]}@example.com"


def _slug() -> str:
    return f"s-{uuid.uuid4().hex[:10]}"


def _csrf(client: AsyncClient) -> dict[str, str]:
    return {"X-CSRF-Token": client.cookies.get("csrf_token") or ""}


def _client(app: FastAPI) -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _new_org(client: AsyncClient) -> str:
    email = _email()
    await client.post(f"{AUTH}/register", json={"email": email, "name": "T", "password": PASSWORD})
    await client.post(f"{AUTH}/login", json={"email": email, "password": PASSWORD})
    resp = await client.post(ORGS, json={"name": "Org", "slug": _slug()}, headers=_csrf(client))
    assert resp.status_code == 201, resp.text
    return resp.json()["activeOrganizationId"]


async def _tournament(client: AsyncClient) -> str:
    resp = await client.post(
        TOUR, json={"name": "SIBL", "slug": _slug(), "sportKey": "badminton"}, headers=_csrf(client)
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _division(client: AsyncClient, tid: str, ptype: str = "individual") -> str:
    resp = await client.post(
        f"{TOUR}/{tid}/divisions",
        json={"name": "Div", "participantType": ptype},
        headers=_csrf(client),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _capacity_division(client: AsyncClient, tid: str, capacity: int) -> str:
    resp = await client.post(
        f"{TOUR}/{tid}/divisions",
        json={"name": "Div", "participantType": "individual", "capacity": capacity},
        headers=_csrf(client),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _open_registration(client: AsyncClient, tid: str) -> None:
    resp = await client.post(
        f"{TOUR}/{tid}/status", json={"status": "registration"}, headers=_csrf(client)
    )
    assert resp.status_code == 200, resp.text


async def _register(client: AsyncClient, did: str, **body) -> dict:
    resp = await client.post(
        f"/api/v1/divisions/{did}/registrations", json=body, headers=_csrf(client)
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---- form_response is now returned to organizers ----


async def test_registration_response_includes_form_response(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    did = await _division(client, tid)
    await _open_registration(client, tid)

    reg = await _register(client, did, formResponse={"note": "please seed me high"})
    assert reg["formResponse"] == {"note": "please seed me high"}

    listed = await client.get(f"/api/v1/divisions/{did}/registrations", headers=_csrf(client))
    assert listed.status_code == 200
    assert listed.json()[0]["formResponse"] == {"note": "please seed me high"}


# ---- GET /teams/{id} exposes roster (partner info) ----


async def test_get_team_returns_roster(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    did = await _division(client, tid, ptype="pair")
    await _open_registration(client, tid)

    reg = await _register(
        client, did, formResponse={"teamName": "Aces", "players": [{"name": "A"}, {"name": "B"}]}
    )
    approved = await client.post(
        f"/api/v1/registrations/{reg['id']}/approve", headers=_csrf(client)
    )
    assert approved.status_code == 200
    parts = await client.get(f"/api/v1/divisions/{did}/participants")
    pair = next(p for p in parts.json() if p["id"] == approved.json()["participantId"])
    team_id = pair["teamId"]
    assert team_id

    team = await client.get(f"/api/v1/teams/{team_id}")
    assert team.status_code == 200, team.text
    body = team.json()
    assert body["name"] == "Aces"
    assert sorted(entry["externalName"] for entry in body["roster"]) == ["A", "B"]


async def test_get_team_404_for_unknown_or_other_org(app, client):
    await _new_org(client)
    resp = await client.get(f"/api/v1/teams/{uuid.uuid4()}")
    assert resp.status_code == 404


# ---- organizer-initiated waitlist ----


async def test_waitlist_registration(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    did = await _division(client, tid)
    await _open_registration(client, tid)

    reg = await _register(client, did)
    resp = await client.post(f"/api/v1/registrations/{reg['id']}/waitlist", headers=_csrf(client))
    assert resp.status_code == 200 and resp.json()["status"] == "waitlisted"

    # A waitlisted registration can still be approved later.
    approve = await client.post(f"/api/v1/registrations/{reg['id']}/approve", headers=_csrf(client))
    assert approve.status_code == 200 and approve.json()["status"] == "approved"


async def test_cannot_waitlist_an_approved_registration(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    did = await _division(client, tid)
    await _open_registration(client, tid)

    reg = await _register(client, did)
    await client.post(f"/api/v1/registrations/{reg['id']}/approve", headers=_csrf(client))
    resp = await client.post(f"/api/v1/registrations/{reg['id']}/waitlist", headers=_csrf(client))
    assert resp.status_code == 409


async def test_capacity_still_auto_waitlists_on_approve(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    did = await _capacity_division(client, tid, capacity=1)
    await _open_registration(client, tid)

    first = await _register(client, did)
    second = await _register(client, did)
    a1 = await client.post(f"/api/v1/registrations/{first['id']}/approve", headers=_csrf(client))
    a2 = await client.post(f"/api/v1/registrations/{second['id']}/approve", headers=_csrf(client))
    assert a1.json()["status"] == "approved"
    assert a2.json()["status"] == "waitlisted" and a2.json()["participantId"] is None


# ---- realtime broadcast ----


async def test_registration_actions_broadcast_on_org_channel(app, client):
    org_id = await _new_org(client)
    tid = await _tournament(client)
    did = await _division(client, tid)
    await _open_registration(client, tid)

    received: list[dict] = []
    gen = get_broadcaster().subscribe(org_channel(uuid.UUID(org_id)))

    async def _collect() -> None:
        async for event in gen:
            received.append(event)
            if len(received) >= 2:
                return

    task = asyncio.create_task(_collect())
    await asyncio.sleep(0.05)  # let the subscriber register

    reg = await _register(client, did)
    await client.post(f"/api/v1/registrations/{reg['id']}/approve", headers=_csrf(client))
    await asyncio.wait_for(task, timeout=3)

    types = {e["type"] for e in received}
    assert "registration.submitted" in types and "registration.approved" in types
    for event in received:
        assert event["data"]["divisionId"] == did


# ---- permissions ----


async def test_only_organizer_can_waitlist_or_list_registrations(app, client):
    recorder_sent: list[dict] = []

    class Recorder:
        async def send(self, to: str, template: str, data: dict) -> str:
            recorder_sent.append({"to": to, "template": template, "data": data})
            return "rec"

    app.dependency_overrides[get_email_channel] = lambda: Recorder()

    await _new_org(client)  # owner
    tid = await _tournament(client)
    did = await _division(client, tid)
    await _open_registration(client, tid)
    reg = await _register(client, did)

    invitee = _email()
    inv = await client.post(
        f"{ORGS}/active/invites", json={"email": invitee, "role": "viewer"}, headers=_csrf(client)
    )
    assert inv.status_code == 201
    token = recorder_sent[-1]["data"]["token"]

    async with _client(app) as viewer:
        await viewer.post(
            f"{AUTH}/register", json={"email": invitee, "name": "V", "password": PASSWORD}
        )
        await viewer.post(f"{AUTH}/login", json={"email": invitee, "password": PASSWORD})
        await viewer.post(f"{ORGS}/invites/accept", json={"token": token}, headers=_csrf(viewer))

        assert (await viewer.get(f"/api/v1/divisions/{did}/registrations")).status_code == 403
        assert (
            await viewer.post(f"/api/v1/registrations/{reg['id']}/waitlist", headers=_csrf(viewer))
        ).status_code == 403
