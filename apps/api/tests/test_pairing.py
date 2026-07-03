"""Smart Pairing integration tests — generate/edit/lock/regenerate/swap/publish, plus
determinism, permissions, isolation, and the singles-division guard. DB-backed."""

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


async def _doubles_division(client: AsyncClient, ptype: str = "pair") -> tuple[str, str]:
    resp = await client.post(
        TOUR, json={"name": "SIBL", "slug": _slug(), "sportKey": "badminton"}, headers=_csrf(client)
    )
    assert resp.status_code == 201, resp.text
    tid = resp.json()["id"]
    div = await client.post(
        f"{TOUR}/{tid}/divisions",
        json={"name": "Open Doubles", "participantType": ptype},
        headers=_csrf(client),
    )
    assert div.status_code == 201, div.text
    await client.post(
        f"{TOUR}/{tid}/status", json={"status": "registration"}, headers=_csrf(client)
    )
    return tid, div.json()["id"]


async def _entrant(client: AsyncClient, did: str, name: str, skill: str, **form: object) -> str:
    resp = await client.post(
        f"/api/v1/divisions/{did}/registrations",
        json={"formResponse": {"name": name, **form}, "skillLevel": skill},
        headers=_csrf(client),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _six_entrants(client: AsyncClient, did: str) -> dict[str, str]:
    """Two of each tier — the canonical fold case (three strength-4 teams)."""
    return {
        "adv1": await _entrant(client, did, "Adv One", "advanced"),
        "adv2": await _entrant(client, did, "Adv Two", "advanced"),
        "int1": await _entrant(client, did, "Int One", "intermediate"),
        "int2": await _entrant(client, did, "Int Two", "intermediate"),
        "beg1": await _entrant(client, did, "Beg One", "beginner"),
        "beg2": await _entrant(client, did, "Beg Two", "beginner"),
    }


async def _generate(client: AsyncClient, did: str, **body: object) -> dict:
    resp = await client.post(
        f"/api/v1/divisions/{did}/pairing/generate", json=body, headers=_csrf(client)
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---- generate ----


async def test_generate_forms_balanced_strength_four_teams(app, client):
    await _new_org(client)
    _tid, did = await _doubles_division(client)
    await _six_entrants(client, did)

    run = await _generate(client, did)
    assert run["status"] == "draft"
    assert len(run["teams"]) == 3
    assert run["unpairedIds"] == []
    assert all(t["strength"] == 4.0 for t in run["teams"])
    assert all(t["confidence"] == 1.0 for t in run["teams"])
    assert run["summary"]["averageConfidence"] == 1.0
    # Each team is one strong + one weak (never 3+3).
    assert all(len(t["memberIds"]) == 2 for t in run["teams"])


async def test_get_pairing_null_before_generate_then_returns_run(app, client):
    await _new_org(client)
    _tid, did = await _doubles_division(client)
    await _six_entrants(client, did)

    empty = await client.get(f"/api/v1/divisions/{did}/pairing")
    assert empty.status_code == 200
    assert empty.json() is None

    await _generate(client, did)
    now = await client.get(f"/api/v1/divisions/{did}/pairing")
    assert now.status_code == 200
    assert now.json()["status"] == "draft"


async def test_generate_is_deterministic(app, client):
    await _new_org(client)
    _tid, did = await _doubles_division(client)
    await _six_entrants(client, did)

    first = await _generate(client, did)
    second = await _generate(client, did)  # discards first, re-rolls
    members_first = sorted(sorted(t["memberIds"]) for t in first["teams"])
    members_second = sorted(sorted(t["memberIds"]) for t in second["teams"])
    assert members_first == members_second


async def test_odd_entrant_count_leaves_a_reserve(app, client):
    await _new_org(client)
    _tid, did = await _doubles_division(client)
    await _entrant(client, did, "A", "advanced")
    await _entrant(client, did, "B", "intermediate")
    await _entrant(client, did, "C", "beginner")

    run = await _generate(client, did)
    assert len(run["teams"]) == 1
    assert len(run["unpairedIds"]) == 1


# ---- edit: lock + regenerate + swap ----


async def test_locked_team_survives_regenerate(app, client):
    await _new_org(client)
    _tid, did = await _doubles_division(client)
    await _six_entrants(client, did)
    run = await _generate(client, did)
    team = run["teams"][0]
    locked_members = set(team["memberIds"])

    lock = await client.patch(
        f"/api/v1/pairing/teams/{team['id']}", json={"locked": True}, headers=_csrf(client)
    )
    assert lock.status_code == 200 and lock.json()["locked"] is True

    regen = await _generate(client, did)
    survived = [set(t["memberIds"]) for t in regen["teams"] if t["locked"]]
    assert locked_members in survived


async def test_swap_members_rebalances_and_rescores(app, client):
    await _new_org(client)
    _tid, did = await _doubles_division(client)
    await _six_entrants(client, did)
    run = await _generate(client, did)

    # Swap one member of each of two teams — proves the op re-scores + re-labels.
    team0, team1 = run["teams"][0], run["teams"][1]
    member_a = team0["memberIds"][0]
    member_b = team1["memberIds"][0]
    resp = await client.post(
        f"/api/v1/pairing/runs/{run['id']}/swap",
        json={"memberA": member_a, "memberB": member_b},
        headers=_csrf(client),
    )
    assert resp.status_code == 200, resp.text
    swapped = resp.json()
    t0 = next(t for t in swapped["teams"] if t["id"] == team0["id"])
    assert member_b in t0["memberIds"] and member_a not in t0["memberIds"]
    assert any("Manually adjusted" in r for r in t0["reasons"])


async def test_swap_same_team_is_rejected(app, client):
    await _new_org(client)
    _tid, did = await _doubles_division(client)
    await _six_entrants(client, did)
    run = await _generate(client, did)
    team = run["teams"][0]
    resp = await client.post(
        f"/api/v1/pairing/runs/{run['id']}/swap",
        json={"memberA": team["memberIds"][0], "memberB": team["memberIds"][1]},
        headers=_csrf(client),
    )
    assert resp.status_code == 422 and resp.json()["code"] == "invalid_swap"


# ---- preferences + forced ----


async def test_forced_group_is_honored(app, client):
    await _new_org(client)
    _tid, did = await _doubles_division(client)
    e = await _six_entrants(client, did)
    run = await _generate(client, did, forcedGroups=[[e["adv1"], e["adv2"]]])
    forced = [set(t["memberIds"]) for t in run["teams"] if t["locked"]]
    assert {e["adv1"], e["adv2"]} in forced


async def test_preferred_partner_from_registration_is_honored(app, client):
    await _new_org(client)
    _tid, did = await _doubles_division(client)
    # B registers first; A registers preferring B (id known at submit time). The engine
    # honors an unrequited preference when the partner is uncontested.
    partner = await _entrant(client, did, "Partner", "beginner")
    await _entrant(client, did, "Chooser", "advanced", preferredPartnerRegistrationId=partner)
    await _entrant(client, did, "C", "intermediate")
    await _entrant(client, did, "D", "intermediate")

    run = await _generate(client, did)
    teams = [set(t["memberIds"]) for t in run["teams"]]
    chooser = next(t for t in run["entrants"] if t["displayName"] == "Chooser")["registrationId"]
    assert any({chooser, partner} == team for team in teams)


# ---- publish ----


async def test_publish_materializes_pair_participants(app, client):
    await _new_org(client)
    _tid, did = await _doubles_division(client)
    await _six_entrants(client, did)
    run = await _generate(client, did)

    resp = await client.post(f"/api/v1/pairing/runs/{run['id']}/publish", headers=_csrf(client))
    assert resp.status_code == 200, resp.text
    assert resp.json()["publishedTeams"] == 3
    assert resp.json()["unpairedCount"] == 0

    # Three pair participants now exist in the division.
    participants = await client.get(f"/api/v1/divisions/{did}/participants")
    assert participants.status_code == 200
    pairs = [p for p in participants.json() if p["kind"] == "pair"]
    assert len(pairs) == 3

    # The run is published and no longer the active draft.
    active = await client.get(f"/api/v1/divisions/{did}/pairing")
    assert active.json() is None


async def test_cannot_edit_a_published_run(app, client):
    await _new_org(client)
    _tid, did = await _doubles_division(client)
    await _six_entrants(client, did)
    run = await _generate(client, did)
    await client.post(f"/api/v1/pairing/runs/{run['id']}/publish", headers=_csrf(client))

    resp = await client.post(
        f"/api/v1/pairing/runs/{run['id']}/swap",
        json={
            "memberA": run["teams"][0]["memberIds"][0],
            "memberB": run["teams"][1]["memberIds"][0],
        },
        headers=_csrf(client),
    )
    assert resp.status_code == 409 and resp.json()["code"] == "not_draft"


# ---- guards: singles, permissions, isolation ----


async def test_singles_division_rejects_pairing(app, client):
    await _new_org(client)
    _tid, did = await _doubles_division(client, ptype="individual")
    await _entrant(client, did, "A", "advanced")
    await _entrant(client, did, "B", "beginner")
    resp = await client.post(
        f"/api/v1/divisions/{did}/pairing/generate", json={}, headers=_csrf(client)
    )
    assert resp.status_code == 422 and resp.json()["code"] == "pairing_unsupported"


async def test_generate_requires_permission(app, client):
    await _new_org(client)
    _tid, did = await _doubles_division(client)
    await _six_entrants(client, did)

    recorder: list[dict] = []

    class Recorder:
        async def send(self, to: str, template: str, data: dict) -> str:
            recorder.append(data)
            return "rec"

    app.dependency_overrides[get_email_channel] = lambda: Recorder()
    invitee = _email()
    inv = await client.post(
        f"{ORGS}/active/invites", json={"email": invitee, "role": "viewer"}, headers=_csrf(client)
    )
    assert inv.status_code == 201
    token = recorder[-1]["token"]

    async with _client(app) as viewer:
        await viewer.post(
            f"{AUTH}/register", json={"email": invitee, "name": "V", "password": PASSWORD}
        )
        await viewer.post(f"{AUTH}/login", json={"email": invitee, "password": PASSWORD})
        await viewer.post(f"{ORGS}/invites/accept", json={"token": token}, headers=_csrf(viewer))
        resp = await viewer.post(
            f"/api/v1/divisions/{did}/pairing/generate", json={}, headers=_csrf(viewer)
        )
        assert resp.status_code == 403


async def test_organization_isolation(app, client):
    await _new_org(client)
    _tid, did = await _doubles_division(client)
    await _six_entrants(client, did)

    async with _client(app) as other:
        await _new_org(other)
        resp = await other.post(
            f"/api/v1/divisions/{did}/pairing/generate", json={}, headers=_csrf(other)
        )
        assert resp.status_code == 404
