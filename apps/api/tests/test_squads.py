"""Squad member swap integration tests — the atomic 1-for-1 trade that backs the
draft ceremony's "Jo Tera Hai Wo Mera" power card. DB-backed (skipped without
DATABASE_URL)."""

from __future__ import annotations

import os
import secrets
import uuid

import pytest
from httpx import AsyncClient

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


async def _new_org(client: AsyncClient) -> str:
    email = _email()
    await client.post(f"{AUTH}/register", json={"email": email, "name": "T", "password": PASSWORD})
    await client.post(f"{AUTH}/login", json={"email": email, "password": PASSWORD})
    resp = await client.post(ORGS, json={"name": "Org", "slug": _slug()}, headers=_csrf(client))
    assert resp.status_code == 201, resp.text
    return resp.json()["activeOrganizationId"]


async def _tournament_with_division(client: AsyncClient) -> tuple[str, str]:
    resp = await client.post(
        TOUR,
        json={"name": "SIBL", "slug": _slug(), "sportKey": "badminton"},
        headers=_csrf(client),
    )
    assert resp.status_code == 201, resp.text
    tid = resp.json()["id"]
    div = await client.post(
        f"{TOUR}/{tid}/divisions",
        json={"name": "Singles", "participantType": "individual"},
        headers=_csrf(client),
    )
    assert div.status_code == 201, div.text
    await client.post(
        f"{TOUR}/{tid}/status", json={"status": "registration"}, headers=_csrf(client)
    )
    return tid, div.json()["id"]


async def _approved_registration(client: AsyncClient, did: str) -> str:
    """Register + approve → return the REGISTRATION id (what squads key on)."""
    reg = await client.post(
        f"/api/v1/divisions/{did}/registrations",
        json={"formResponse": {"name": f"Player {uuid.uuid4().hex[:4]}"}},
        headers=_csrf(client),
    )
    assert reg.status_code == 201, reg.text
    rid = reg.json()["id"]
    approve = await client.post(f"/api/v1/registrations/{rid}/approve", headers=_csrf(client))
    assert approve.status_code == 200, approve.text
    return rid


async def _squad(client: AsyncClient, tid: str, name: str) -> str:
    resp = await client.post(f"{TOUR}/{tid}/squads", json={"name": name}, headers=_csrf(client))
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _assign(client: AsyncClient, squad_id: str, registration_id: str) -> None:
    resp = await client.post(
        f"/api/v1/squads/{squad_id}/members",
        json={"registrationId": registration_id},
        headers=_csrf(client),
    )
    assert resp.status_code == 200, resp.text


async def _swap(client: AsyncClient, tid: str, a_sq, a_reg, b_sq, b_reg):
    return await client.post(
        f"{TOUR}/{tid}/squads/swap-members",
        json={
            "squadAId": a_sq,
            "registrationAId": a_reg,
            "squadBId": b_sq,
            "registrationBId": b_reg,
        },
        headers=_csrf(client),
    )


def _members(board: dict, squad_id: str) -> set[str]:
    squad = next(s for s in board["squads"] if s["id"] == squad_id)
    return {m["registrationId"] for m in squad["members"]}


async def _two_teams(client: AsyncClient):
    """Team A holds a1, Team B holds b1. Returns (tid, sq_a, a1, sq_b, b1)."""
    await _new_org(client)
    tid, did = await _tournament_with_division(client)
    sq_a = await _squad(client, tid, "Team A")
    sq_b = await _squad(client, tid, "Team B")
    a1 = await _approved_registration(client, did)
    b1 = await _approved_registration(client, did)
    await _assign(client, sq_a, a1)
    await _assign(client, sq_b, b1)
    return tid, sq_a, a1, sq_b, b1


# ============================================================
# Happy path
# ============================================================


async def test_swap_moves_both_members(app, client):
    tid, sq_a, a1, sq_b, b1 = await _two_teams(client)

    resp = await _swap(client, tid, sq_a, a1, sq_b, b1)
    assert resp.status_code == 200, resp.text

    board = resp.json()
    assert _members(board, sq_a) == {b1}
    assert _members(board, sq_b) == {a1}

    # Re-read from the server: the response must reflect persisted state, not a
    # stale in-session view of the rosters.
    fresh = (await client.get(f"{TOUR}/{tid}/squads")).json()
    assert _members(fresh, sq_a) == {b1}
    assert _members(fresh, sq_b) == {a1}


async def test_swap_keeps_team_sizes_identical(app, client):
    tid, sq_a, a1, sq_b, b1 = await _two_teams(client)

    resp = await _swap(client, tid, sq_a, a1, sq_b, b1)
    board = resp.json()

    for squad_id in (sq_a, sq_b):
        squad = next(s for s in board["squads"] if s["id"] == squad_id)
        assert squad["memberCount"] == 1


async def test_swap_leaves_nobody_unassigned(app, client):
    """The whole point of the atomic endpoint — no half-applied state."""
    tid, sq_a, a1, sq_b, b1 = await _two_teams(client)

    resp = await _swap(client, tid, sq_a, a1, sq_b, b1)
    board = resp.json()

    unassigned = {u["registrationId"] for u in board["unassigned"]}
    assert a1 not in unassigned
    assert b1 not in unassigned


# ============================================================
# Validation / rejection
# ============================================================


async def test_swap_rejects_captain(app, client):
    tid, sq_a, a1, sq_b, b1 = await _two_teams(client)
    # Make a1 the captain of Team A.
    patch = await client.patch(
        f"/api/v1/squads/{sq_a}",
        json={"captainRegistrationId": a1},
        headers=_csrf(client),
    )
    assert patch.status_code == 200, patch.text

    resp = await _swap(client, tid, sq_a, a1, sq_b, b1)
    assert resp.status_code == 422, resp.text

    # Nothing moved.
    board = (await client.get(f"{TOUR}/{tid}/squads")).json()
    assert _members(board, sq_a) == {a1}
    assert _members(board, sq_b) == {b1}


async def test_swap_rejects_same_team(app, client):
    tid, sq_a, a1, sq_b, b1 = await _two_teams(client)
    resp = await _swap(client, tid, sq_a, a1, sq_a, a1)
    assert resp.status_code == 422, resp.text


async def test_swap_rejects_member_not_on_named_team(app, client):
    tid, sq_a, a1, sq_b, b1 = await _two_teams(client)
    # Claim a1 is on Team B (it is not).
    resp = await _swap(client, tid, sq_b, a1, sq_a, b1)
    assert resp.status_code == 404, resp.text


async def test_swap_rejects_squad_from_other_tournament(app, client):
    tid, sq_a, a1, sq_b, b1 = await _two_teams(client)
    other_tid, _ = await _tournament_with_division(client)

    resp = await _swap(client, other_tid, sq_a, a1, sq_b, b1)
    assert resp.status_code == 422, resp.text


async def test_swap_requires_auth(app, client):
    tid, sq_a, a1, sq_b, b1 = await _two_teams(client)
    await client.post(f"{AUTH}/logout", headers=_csrf(client))

    resp = await _swap(client, tid, sq_a, a1, sq_b, b1)
    assert resp.status_code in (401, 403), resp.text
