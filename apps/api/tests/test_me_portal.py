"""Participant portal API tests."""

from __future__ import annotations

import os
import secrets
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

DATABASE_URL = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not set")

PASSWORD = secrets.token_urlsafe(16)
AUTH = "/api/v1/auth"
ORGS = "/api/v1/orgs"
TOUR = "/api/v1/tournaments"
ME = "/api/v1/me"


def _client(app) -> AsyncClient:
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


async def _division(client: AsyncClient) -> tuple[str, str]:
    resp = await client.post(
        TOUR,
        json={"name": "SIBL", "slug": _slug(), "sportKey": "badminton"},
        headers=_csrf(client),
    )
    assert resp.status_code == 201, resp.text
    tid = resp.json()["id"]
    div = await client.post(
        f"{TOUR}/{tid}/divisions",
        json={"name": "Doubles", "participantType": "individual"},
        headers=_csrf(client),
    )
    assert div.status_code == 201, div.text
    await client.post(
        f"{TOUR}/{tid}/status", json={"status": "registration"}, headers=_csrf(client)
    )
    return tid, div.json()["id"]


async def test_portal_lists_my_registration(app, client):
    await _new_org(client)
    _tid, did = await _division(client)

    reg = await client.post(
        f"/api/v1/divisions/{did}/registrations",
        json={"formResponse": {"name": "Alice", "email": "alice@example.com"}},
        headers=_csrf(client),
    )
    assert reg.status_code == 201, reg.text

    resp = await client.get(f"{ME}/portal")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body["registrations"]) == 1
    assert body["registrations"][0]["status"] == "submitted"
    assert body["registrations"][0]["divisionName"] == "Doubles"
    assert body["participations"] == []
    assert body["upcomingMatches"] == []
    assert body["recentMatches"] == []


async def test_portal_lists_participation_after_approval(app, client):
    await _new_org(client)
    _tid, did = await _division(client)

    reg = await client.post(
        f"/api/v1/divisions/{did}/registrations",
        json={"formResponse": {"name": "Bob"}},
        headers=_csrf(client),
    )
    rid = reg.json()["id"]
    approve = await client.post(f"/api/v1/registrations/{rid}/approve", headers=_csrf(client))
    assert approve.status_code == 200, approve.text

    resp = await client.get(f"{ME}/portal")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body["participations"]) == 1
    assert body["participations"][0]["displayName"] == "Bob"
    assert body["participations"][0]["attendance"] == "pending"


async def test_portal_requires_auth(app, client):
    resp = await client.get(f"{ME}/portal")
    assert resp.status_code == 401
