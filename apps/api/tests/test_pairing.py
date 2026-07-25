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


async def test_regenerate_survives_locked_duplicate_pair(app, client):
    """Odd squad: duplicate pair locks a player into two teams — regenerate must not 422."""
    await _new_org(client)
    _tid, did = await _doubles_division(client)
    await _entrant(client, did, "A", "advanced")
    await _entrant(client, did, "B", "intermediate")
    await _entrant(client, did, "C", "beginner")

    run = await _generate(client, did)
    assert len(run["teams"]) == 1
    assert len(run["unpairedIds"]) == 1
    unpaired = run["unpairedIds"][0]
    paired_team = run["teams"][0]
    duplicate_id = next(m for m in paired_team["memberIds"] if m != unpaired)

    dup = await client.post(
        f"/api/v1/pairing/runs/{run['id']}/duplicate-pair",
        json={"unpairedId": unpaired, "duplicateId": duplicate_id},
        headers=_csrf(client),
    )
    assert dup.status_code == 200, dup.text

    lock = await client.patch(
        f"/api/v1/pairing/teams/{paired_team['id']}",
        json={"locked": True},
        headers=_csrf(client),
    )
    assert lock.status_code == 200

    regen = await client.post(
        f"/api/v1/divisions/{did}/pairing/generate", json={}, headers=_csrf(client)
    )
    assert regen.status_code == 201, regen.text
    body = regen.json()
    assert any(
        set(t["memberIds"]) == {unpaired, duplicate_id} and t["locked"] for t in body["teams"]
    )
    assert set(paired_team["memberIds"]) in [
        set(t["memberIds"]) for t in body["teams"] if t["locked"]
    ]


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


async def test_published_pair_carries_its_squad_not_its_own_name(app, client):
    """The pair's team tag must name the SQUAD it was drafted from.

    Regression: surfaces read `Team.name`, which for a pair is the pair's own
    name, so every tag duplicated the pair heading instead of showing the
    franchise.
    """
    await _new_org(client)
    tid, did = await _doubles_division(client)
    regs = await _six_entrants(client, did)

    # Draft everyone into one squad. Note: do NOT approve — pairing only considers
    # submitted/waitlisted entrants, and squads accept submitted too.
    squad = await client.post(
        f"{TOUR}/{tid}/squads", json={"name": "Smashers"}, headers=_csrf(client)
    )
    assert squad.status_code == 201, squad.text
    squad_id = squad.json()["id"]
    for rid in regs.values():
        assign = await client.post(
            f"/api/v1/squads/{squad_id}/members",
            json={"registrationId": rid},
            headers=_csrf(client),
        )
        assert assign.status_code == 200, assign.text

    run = await _generate(client, did)
    published = await client.post(
        f"/api/v1/pairing/runs/{run['id']}/publish", headers=_csrf(client)
    )
    assert published.status_code == 200, published.text

    participants = await client.get(f"/api/v1/divisions/{did}/participants")
    pairs = [p for p in participants.json() if p["kind"] == "pair"]
    assert pairs, "expected published pairs"

    for pair in pairs:
        assert pair["teamName"] == "Smashers"
        # The tag must not merely echo the pair's own label.
        assert pair["teamName"] != pair["displayName"]


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
    team = await client.get(f"/api/v1/teams/{pairs[0]['teamId']}")
    assert team.status_code == 200
    roster_names = {entry["externalName"] for entry in team.json()["roster"]}
    assert len(roster_names) == 2
    assert roster_names <= {"Adv One", "Adv Two", "Int One", "Int Two", "Beg One", "Beg Two"}

    # After publishing, GET /pairing returns the published run (draft-first,
    # published-fallback) so the UI can show "N pairs locked".  There is no
    # active draft, so status must be "published" and not "draft".
    active = await client.get(f"/api/v1/divisions/{did}/pairing")
    assert active.json() is not None
    assert active.json()["status"] == "published"


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


# ---- squad-scoped pairing: strength attaches to the right pair (regression) ----


async def _sq_entrant(client, did, name, skill):
    r = await client.post(
        f"/api/v1/divisions/{did}/registrations",
        json={"formResponse": {"name": name}, "skillLevel": skill},
        headers=_csrf(client),
    )
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    await client.post(f"/api/v1/registrations/{rid}/approve", headers=_csrf(client))
    return rid


async def test_squad_scoped_pairing_attaches_strength_to_the_right_pair(app, client):
    """Regression: with one pairing run published per squad, squad_pair_map used to
    zip proposed teams (draft order) against pair participants (publish order) by
    position. Publish a squad out of draft order and a strength landed on the wrong
    pair — a 4-strength pair sorted ahead of a 5 and met the other team's 5. Match by
    identity instead, so every squad still sorts strongest-first.
    """
    await _new_org(client)
    tour = await client.post(
        TOUR, json={"name": "SIBL", "slug": _slug(), "sportKey": "badminton"}, headers=_csrf(client)
    )
    tid = tour.json()["id"]
    div = await client.post(
        f"{TOUR}/{tid}/divisions",
        json={"name": "Franchise", "participantType": "squad"},
        headers=_csrf(client),
    )
    did = div.json()["id"]
    await client.post(
        f"{TOUR}/{tid}/status", json={"status": "registration"}, headers=_csrf(client)
    )

    # Two squads, each: 2 advanced + 2 intermediate → manual pairs adv+adv (6) and
    # int+int (4), so a misordering is detectable.
    squads = {}
    for name in ("Alpha", "Beta"):
        sq = await client.post(f"{TOUR}/{tid}/squads", json={"name": name}, headers=_csrf(client))
        squads[name] = sq.json()["id"]

    regs = {}
    for name, sid in squads.items():
        regs[name] = {
            "a1": await _sq_entrant(client, did, f"{name} AdvOne", "advanced"),
            "a2": await _sq_entrant(client, did, f"{name} AdvTwo", "advanced"),
            "i1": await _sq_entrant(client, did, f"{name} IntOne", "intermediate"),
            "i2": await _sq_entrant(client, did, f"{name} IntTwo", "intermediate"),
        }
        for rid in regs[name].values():
            await client.post(
                f"/api/v1/squads/{sid}/members", json={"registrationId": rid}, headers=_csrf(client)
            )

    async def build_run(name):
        sid = squads[name]
        run = await client.post(
            f"/api/v1/divisions/{did}/pairing/generate",
            json={"squadId": sid, "manual": True},
            headers=_csrf(client),
        )
        assert run.status_code == 201, run.text
        run_id = run.json()["id"]
        for members in ([regs[name]["a1"], regs[name]["a2"]], [regs[name]["i1"], regs[name]["i2"]]):
            added = await client.post(
                f"/api/v1/pairing/runs/{run_id}/teams",
                json={"memberIds": members},
                headers=_csrf(client),
            )
            assert added.status_code in (200, 201), added.text
        return run_id

    # Draft Alpha first, then Beta — but PUBLISH Beta first. This is the order
    # divergence that broke the positional zip.
    run_alpha = await build_run("Alpha")
    run_beta = await build_run("Beta")
    for run_id in (run_beta, run_alpha):
        pub = await client.post(f"/api/v1/pairing/runs/{run_id}/publish", headers=_csrf(client))
        assert pub.status_code == 200, pub.text

    # Generate the team draw and read the legs back through the real endpoint —
    # the guarantee the organizer sees: leg N is an equal matchup on both sides.
    stage = await client.post(
        f"/api/v1/divisions/{did}/stages",
        json={"type": "round_robin", "seq": 0},
        headers=_csrf(client),
    )
    sid = stage.json()["id"]
    draw = await client.post(f"/api/v1/stages/{sid}/franchise-draw", json={}, headers=_csrf(client))
    assert draw.status_code in (200, 201), draw.text

    board = await client.get(f"/api/v1/stages/{sid}/franchise-ties", headers=_csrf(client))
    ties = board.json()["ties"]
    assert ties, "expected a fixture"

    weight = {"advanced": 3, "intermediate": 2, "beginner": 1}
    skill_of = {}
    for name, tier in (
        ("AdvOne", "advanced"),
        ("AdvTwo", "advanced"),
        ("IntOne", "intermediate"),
        ("IntTwo", "intermediate"),
    ):
        for sq in ("Alpha", "Beta"):
            skill_of[f"{sq} {name}"] = weight[tier]

    def strength(pair_name: str) -> int:
        return sum(skill_of.get(p.strip(), 0) for p in pair_name.split(" / "))

    # Alpha's strongest pair (6) must meet Beta's strongest (6), and the 4s meet.
    for leg in ties[0]["legs"]:
        h, a = strength(leg["homePairName"]), strength(leg["awayPairName"])
        assert (
            h == a
        ), f"leg {leg['legIndex'] + 1}: {h} vs {a} — {leg['homePairName']} / {leg['awayPairName']}"
