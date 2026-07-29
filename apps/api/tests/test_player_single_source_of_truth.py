"""Player Management — single source of truth.

Verifies that editing or removing a player on the Players page propagates correctly
to every surface that shows player data: registration form_response, pair names on
brackets/match views, and pre-check flags on the participant response.

DB-backed (skips without DATABASE_URL).
"""

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
    """Create org + tournament + singles division, return (tournament_id, division_id)."""
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


async def test_edit_mirrors_all_fields_to_registration(app, client):
    """Editing email/phone/gender/partner_preference propagates to form_response."""
    _, did = await _setup(client)
    rid, pid = await _register_approve(client, did, "Rahul", "beginner")

    patch = await client.patch(
        f"/api/v1/participants/{pid}",
        json={
            "displayName": "Rahul Sharma",
            "email": "rahul@example.com",
            "phone": "+911234567890",
            "gender": "Male",
            "partnerPreference": "Amit",
        },
        headers=_csrf(client),
    )
    assert patch.status_code == 200, patch.text

    reg_detail = await client.get(f"/api/v1/registrations/{rid}")
    assert reg_detail.status_code == 200, reg_detail.text
    fr = reg_detail.json()["formResponse"]
    assert fr["name"] == "Rahul Sharma"
    assert fr["email"] == "rahul@example.com"
    assert fr["phone"] == "+911234567890"
    assert fr["gender"] == "Male"
    assert fr["preferredPartnerName"] == "Amit"


async def test_edit_skill_mirrors_to_registration(app, client):
    """Editing skill_level mirrors to Registration.skill_level (regression guard)."""
    _, did = await _setup(client)
    rid, pid = await _register_approve(client, did, "Priya", "beginner")

    patch = await client.patch(
        f"/api/v1/participants/{pid}",
        json={"skillLevel": "advanced"},
        headers=_csrf(client),
    )
    assert patch.status_code == 200, patch.text

    reg_detail = await client.get(f"/api/v1/registrations/{rid}")
    assert reg_detail.json()["skillLevel"] == "advanced"


async def test_participant_response_has_precheck_flags_unpaired(app, client):
    """A player with no pair and no matches has both pre-check flags False."""
    _, did = await _setup(client)
    _, pid = await _register_approve(client, did, "Solo", "intermediate")

    participants = (await client.get(f"/api/v1/divisions/{did}/participants")).json()
    p = next(p for p in participants if p["id"] == pid)
    assert p["hasPublishedPair"] is False
    assert p["hasMatchResults"] is False


async def test_remove_player_not_in_pair_succeeds(app, client):
    """A player with no pair and no match results can be removed cleanly."""
    _, did = await _setup(client)
    _, pid = await _register_approve(client, did, "Removable", "beginner")

    resp = await client.delete(f"/api/v1/participants/{pid}", headers=_csrf(client))
    assert resp.status_code == 200, resp.text

    participants = (await client.get(f"/api/v1/divisions/{did}/participants")).json()
    assert not any(p["id"] == pid for p in participants)


async def test_remove_player_in_squad_removes_squad_member(app, client):
    """Removing a player who is on a franchise squad drops them from the squad."""
    tid, did = await _setup(client)
    sq = (
        await client.post(f"{TOUR}/{tid}/squads", json={"name": "Team A"}, headers=_csrf(client))
    ).json()["id"]
    rid, pid = await _register_approve(client, did, "Squad Member", "intermediate")
    await client.post(
        f"/api/v1/squads/{sq}/members", json={"registrationId": rid}, headers=_csrf(client)
    )

    resp = await client.delete(f"/api/v1/participants/{pid}", headers=_csrf(client))
    assert resp.status_code == 200, resp.text

    board = (await client.get(f"{TOUR}/{tid}/squads")).json()
    squad = next(s for s in board["squads"] if s["id"] == sq)
    assert not any(m["registrationId"] == rid for m in squad["members"])
