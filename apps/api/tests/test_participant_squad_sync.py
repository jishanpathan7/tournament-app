"""Editing or removing a player on the Players page must reach the Teams board.

Franchise team cards (and the doubles-pairing engine) read the REGISTRATION that a
squad member references — not the Participant that the Players page edits/deletes.
So a participant edit must mirror onto the registration, and a participant removal
must drop the squad membership, or the change never shows on the Teams page.
DB-backed (skips without a database)."""

from __future__ import annotations

import os
import secrets
import uuid

import pytest
from httpx import AsyncClient

DATABASE_URL = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not set")

PASSWORD = "Aa1-" + secrets.token_urlsafe(16)
AUTH = "/api/v1/auth"
ORGS = "/api/v1/orgs"
TOUR = "/api/v1/tournaments"


def _email() -> str:
    return f"u-{uuid.uuid4().hex[:12]}@example.com"


def _slug() -> str:
    return f"s-{uuid.uuid4().hex[:10]}"


def _csrf(client: AsyncClient) -> dict[str, str]:
    return {"X-CSRF-Token": client.cookies.get("csrf_token") or ""}


async def _setup(client: AsyncClient) -> tuple[str, str]:
    email = _email()
    await client.post(f"{AUTH}/register", json={"email": email, "name": "T", "password": PASSWORD})
    await client.post(f"{AUTH}/login", json={"email": email, "password": PASSWORD})
    await client.post(ORGS, json={"name": "Acme", "slug": _slug()}, headers=_csrf(client))
    t = await client.post(
        TOUR,
        json={"name": "SIBL", "slug": _slug(), "sportKey": "badminton"},
        headers=_csrf(client),
    )
    tid = t.json()["id"]
    div = await client.post(
        f"{TOUR}/{tid}/divisions",
        json={"name": "Singles", "participantType": "individual"},
        headers=_csrf(client),
    )
    await client.post(
        f"{TOUR}/{tid}/status", json={"status": "registration"}, headers=_csrf(client)
    )
    return tid, div.json()["id"]


async def _register_approve(
    client: AsyncClient, did: str, name: str, skill: str
) -> tuple[str, str]:
    reg = await client.post(
        f"/api/v1/divisions/{did}/registrations",
        json={"formResponse": {"name": name}, "skillLevel": skill},
        headers=_csrf(client),
    )
    assert reg.status_code == 201, reg.text
    rid = reg.json()["id"]
    approve = await client.post(f"/api/v1/registrations/{rid}/approve", headers=_csrf(client))
    assert approve.status_code == 200, approve.text
    return rid, approve.json()["participantId"]


async def _squad_member(client: AsyncClient, tid: str, squad_id: str, reg_id: str) -> dict | None:
    board = (await client.get(f"{TOUR}/{tid}/squads")).json()
    squad = next(s for s in board["squads"] if s["id"] == squad_id)
    return next((m for m in squad["members"] if m["registrationId"] == reg_id), None)


async def test_editing_a_player_updates_their_team_card(app, client):
    tid, did = await _setup(client)
    sq = (
        await client.post(f"{TOUR}/{tid}/squads", json={"name": "Team A"}, headers=_csrf(client))
    ).json()["id"]
    reg_id, pid = await _register_approve(client, did, "Rahul", "beginner")
    await client.post(
        f"/api/v1/squads/{sq}/members", json={"registrationId": reg_id}, headers=_csrf(client)
    )

    before = await _squad_member(client, tid, sq, reg_id)
    assert before is not None and before["displayName"] == "Rahul"
    assert before["skillLevel"] == "beginner"

    # Edit on the Players page (participant PATCH).
    patch = await client.patch(
        f"/api/v1/participants/{pid}",
        json={"displayName": "Rahul Sharma", "skillLevel": "advanced"},
        headers=_csrf(client),
    )
    assert patch.status_code == 200, patch.text

    # The Teams board (which reads the registration) reflects both changes.
    after = await _squad_member(client, tid, sq, reg_id)
    assert after is not None
    assert after["displayName"] == "Rahul Sharma"
    assert after["skillLevel"] == "advanced"


async def test_removing_a_player_drops_them_from_their_team(app, client):
    tid, did = await _setup(client)
    sq = (
        await client.post(f"{TOUR}/{tid}/squads", json={"name": "Team A"}, headers=_csrf(client))
    ).json()["id"]
    reg_id, pid = await _register_approve(client, did, "Amit", "intermediate")
    await client.post(
        f"/api/v1/squads/{sq}/members", json={"registrationId": reg_id}, headers=_csrf(client)
    )
    assert await _squad_member(client, tid, sq, reg_id) is not None

    # Delete on the Players page (participant DELETE).
    resp = await client.delete(f"/api/v1/participants/{pid}", headers=_csrf(client))
    assert resp.status_code == 200, resp.text

    # They're gone from the team.
    assert await _squad_member(client, tid, sq, reg_id) is None
