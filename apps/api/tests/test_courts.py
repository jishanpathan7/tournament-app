"""Court management — venues, courts, tournament assignment, permissions, isolation.
DB-backed (skips without a database)."""

from __future__ import annotations

import os
import secrets
import uuid

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.factory import get_email_channel

DATABASE_URL = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not set")

PASSWORD = secrets.token_urlsafe(16)
AUTH = "/api/v1/auth"
ORGS = "/api/v1/orgs"
TOUR = "/api/v1/tournaments"


def _client(app: FastAPI) -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _email() -> str:
    return f"u-{uuid.uuid4().hex[:12]}@example.com"


def _slug() -> str:
    return f"s-{uuid.uuid4().hex[:10]}"


def _csrf(client: AsyncClient) -> dict[str, str]:
    return {"X-CSRF-Token": client.cookies.get("csrf_token") or ""}


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


async def _venue(client: AsyncClient, name: str = "Main Gym") -> str:
    resp = await client.post("/api/v1/venues", json={"name": name}, headers=_csrf(client))
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _court(client: AsyncClient, venue_id: str, name: str = "Court 1") -> str:
    resp = await client.post(
        "/api/v1/courts", json={"venueId": venue_id, "name": name}, headers=_csrf(client)
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _invite_viewer(client: AsyncClient, app: FastAPI) -> tuple[str, str]:
    """Invite a `viewer` into the caller's active org; returns (email, token)."""
    recorder_sent: list[dict] = []

    class Recorder:
        async def send(self, to: str, template: str, data: dict) -> str:
            recorder_sent.append({"to": to, "template": template, "data": data})
            return "rec"

    app.dependency_overrides[get_email_channel] = lambda: Recorder()

    invitee = _email()
    inv = await client.post(
        f"{ORGS}/active/invites", json={"email": invitee, "role": "viewer"}, headers=_csrf(client)
    )
    assert inv.status_code == 201, inv.text
    return invitee, recorder_sent[-1]["data"]["token"]


# ---- venues + courts CRUD ----


async def test_create_venue_and_court(app, client):
    await _new_org(client)
    venue_id = await _venue(client)
    court_id = await _court(client, venue_id, "Court A")

    courts = await client.get("/api/v1/courts")
    assert courts.status_code == 200
    body = next(c for c in courts.json() if c["id"] == court_id)
    assert body["name"] == "Court A"
    assert body["venueId"] == venue_id
    assert body["status"] == "active"


async def test_update_court_name_and_disable(app, client):
    await _new_org(client)
    venue_id = await _venue(client)
    court_id = await _court(client, venue_id)

    resp = await client.patch(
        f"/api/v1/courts/{court_id}",
        json={"name": "Renamed", "status": "disabled"},
        headers=_csrf(client),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["name"] == "Renamed"
    assert resp.json()["status"] == "disabled"


async def test_update_court_rejects_unknown_status(app, client):
    await _new_org(client)
    venue_id = await _venue(client)
    court_id = await _court(client, venue_id)

    resp = await client.patch(
        f"/api/v1/courts/{court_id}", json={"status": "on_fire"}, headers=_csrf(client)
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "invalid_court_status"


# ---- tournament assignment ----


async def test_assign_and_list_tournament_courts(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    venue_id = await _venue(client)
    court_id = await _court(client, venue_id)

    resp = await client.post(
        f"{TOUR}/{tid}/courts", json={"courtId": court_id}, headers=_csrf(client)
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["court"]["id"] == court_id

    listed = await client.get(f"{TOUR}/{tid}/courts")
    assert listed.status_code == 200
    assert [c["court"]["id"] for c in listed.json()] == [court_id]


async def test_assign_same_court_twice_conflicts(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    venue_id = await _venue(client)
    court_id = await _court(client, venue_id)

    await client.post(f"{TOUR}/{tid}/courts", json={"courtId": court_id}, headers=_csrf(client))
    dupe = await client.post(
        f"{TOUR}/{tid}/courts", json={"courtId": court_id}, headers=_csrf(client)
    )
    assert dupe.status_code == 409
    assert dupe.json()["code"] == "already_assigned"


async def test_unassign_court(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    venue_id = await _venue(client)
    court_id = await _court(client, venue_id)
    await client.post(f"{TOUR}/{tid}/courts", json={"courtId": court_id}, headers=_csrf(client))

    resp = await client.delete(f"{TOUR}/{tid}/courts/{court_id}", headers=_csrf(client))
    assert resp.status_code == 204

    listed = await client.get(f"{TOUR}/{tid}/courts")
    assert listed.json() == []


async def test_unassign_court_not_assigned_is_404(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    venue_id = await _venue(client)
    court_id = await _court(client, venue_id)

    resp = await client.delete(f"{TOUR}/{tid}/courts/{court_id}", headers=_csrf(client))
    assert resp.status_code == 404


async def test_bulk_create_courts(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    venue_id = await _venue(client)

    resp = await client.post(
        f"{TOUR}/{tid}/courts/bulk-create",
        json={"venueId": venue_id, "count": 4, "namePrefix": "Court ", "startNumber": 1},
        headers=_csrf(client),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert len(body["created"]) == 4
    names = [c["court"]["name"] for c in body["created"]]
    assert names == ["Court 1", "Court 2", "Court 3", "Court 4"]

    listed = await client.get(f"{TOUR}/{tid}/courts")
    assert len(listed.json()) == 4


async def test_bulk_create_courts_with_new_venue(app, client):
    await _new_org(client)
    tid = await _tournament(client)

    resp = await client.post(
        f"{TOUR}/{tid}/courts/bulk-create",
        json={"newVenueName": "Sports Hall", "count": 2, "namePrefix": "C", "startNumber": 5},
        headers=_csrf(client),
    )
    assert resp.status_code == 201, resp.text
    names = [c["court"]["name"] for c in resp.json()["created"]]
    assert names == ["C5", "C6"]
    assert resp.json()["created"][0]["court"]["venueName"] == "Sports Hall"


async def test_bulk_remove_courts(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    venue_id = await _venue(client)

    created = await client.post(
        f"{TOUR}/{tid}/courts/bulk-create",
        json={"venueId": venue_id, "count": 3, "namePrefix": "Court ", "startNumber": 1},
        headers=_csrf(client),
    )
    court_ids = [c["court"]["id"] for c in created.json()["created"]]

    resp = await client.post(
        f"{TOUR}/{tid}/courts/bulk-remove",
        json={"courtIds": court_ids[:2]},
        headers=_csrf(client),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["removed"] == court_ids[:2]

    listed = await client.get(f"{TOUR}/{tid}/courts")
    assert len(listed.json()) == 1
    assert listed.json()[0]["court"]["id"] == court_ids[2]


async def test_bulk_remove_courts_not_assigned_is_404(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    venue_id = await _venue(client)
    court_id = await _court(client, venue_id)

    resp = await client.post(
        f"{TOUR}/{tid}/courts/bulk-remove",
        json={"courtIds": [court_id]},
        headers=_csrf(client),
    )
    assert resp.status_code == 404


# ---- permissions + isolation ----


async def test_court_mutations_require_schedule_manage_permission(app, client):
    await _new_org(client)
    invitee, token = await _invite_viewer(client, app)

    async with _client(app) as viewer:
        await viewer.post(
            f"{AUTH}/register", json={"email": invitee, "name": "V", "password": PASSWORD}
        )
        await viewer.post(f"{AUTH}/login", json={"email": invitee, "password": PASSWORD})
        await viewer.post(f"{ORGS}/invites/accept", json={"token": token}, headers=_csrf(viewer))

        resp = await viewer.post(
            "/api/v1/venues", json={"name": "Someone's Gym"}, headers=_csrf(viewer)
        )
        assert resp.status_code == 403


async def test_court_reads_require_org_membership(app, client):
    await _new_org(client)
    venue_id = await _venue(client)
    await _court(client, venue_id)

    async with _client(app) as other:
        await _new_org(other)
        resp = await other.get("/api/v1/courts")
        assert resp.status_code == 200
        assert resp.json() == []  # org-scoped: sees none of the first org's courts
