"""Tournament domain integration tests — the full organizer workflow end to end.

Covers tournament creation/config, registration lifecycle, participant approval
(singles + doubles/team via the Sport Profile), draw generation + persistence
(round robin + single elimination), authorization, and organization isolation.
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


async def _tournament(client: AsyncClient, sport: str = "badminton") -> str:
    resp = await client.post(
        TOUR, json={"name": "SIBL", "slug": _slug(), "sportKey": sport}, headers=_csrf(client)
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _division(client: AsyncClient, tid: str, ptype: str = "individual", **extra) -> str:
    resp = await client.post(
        f"{TOUR}/{tid}/divisions",
        json={"name": "Div", "participantType": ptype, **extra},
        headers=_csrf(client),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _stage(client: AsyncClient, did: str, fmt: str = "round_robin") -> str:
    resp = await client.post(
        f"/api/v1/divisions/{did}/stages",
        json={"type": fmt, "seq": 1},
        headers=_csrf(client),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _open_registration(client: AsyncClient, tid: str) -> None:
    resp = await client.post(
        f"{TOUR}/{tid}/status", json={"status": "registration"}, headers=_csrf(client)
    )
    assert resp.status_code == 200, resp.text


async def _approved_entrants(client: AsyncClient, did: str, n: int) -> None:
    for _ in range(n):
        reg = await client.post(
            f"/api/v1/divisions/{did}/registrations",
            json={"formResponse": {}},
            headers=_csrf(client),
        )
        assert reg.status_code == 201, reg.text
        approve = await client.post(
            f"/api/v1/registrations/{reg.json()['id']}/approve", headers=_csrf(client)
        )
        assert approve.status_code == 200 and approve.json()["status"] == "approved"


# ---- 1. creation + config ----


async def test_create_and_configure_tournament(app, client):
    await _new_org(client)
    resp = await client.post(
        TOUR,
        json={"name": "SIBL 2026", "slug": _slug(), "sportKey": "badminton"},
        headers=_csrf(client),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "draft" and body["sportKey"] == "badminton"

    patched = await client.patch(
        f"{TOUR}/{body['id']}", json={"name": "SIBL Renamed"}, headers=_csrf(client)
    )
    assert patched.status_code == 200 and patched.json()["name"] == "SIBL Renamed"


async def test_create_tournament_rejects_unknown_sport(app, client):
    await _new_org(client)
    resp = await client.post(
        TOUR, json={"name": "X", "slug": _slug(), "sportKey": "quidditch"}, headers=_csrf(client)
    )
    assert resp.status_code == 422 and resp.json()["code"] == "unsupported_sport"


async def test_division_rejects_unsupported_participant_type(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    # badminton supports individual/pair, not team
    resp = await client.post(
        f"{TOUR}/{tid}/divisions",
        json={"name": "Squad", "participantType": "team"},
        headers=_csrf(client),
    )
    assert resp.status_code == 422 and resp.json()["code"] == "unsupported_participant_type"


# ---- 2. registration lifecycle + approval ----


async def test_registration_lifecycle(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    did = await _division(client, tid)

    # registration closed while tournament is draft
    early = await client.post(
        f"/api/v1/divisions/{did}/registrations", json={"formResponse": {}}, headers=_csrf(client)
    )
    assert early.status_code == 422 and early.json()["code"] == "registration_closed"

    await _open_registration(client, tid)
    reg = await client.post(
        f"/api/v1/divisions/{did}/registrations", json={"formResponse": {}}, headers=_csrf(client)
    )
    assert reg.status_code == 201 and reg.json()["status"] == "submitted"
    rid = reg.json()["id"]

    approved = await client.post(f"/api/v1/registrations/{rid}/approve", headers=_csrf(client))
    assert approved.status_code == 200 and approved.json()["status"] == "approved"
    # re-approving is a conflict
    assert (
        await client.post(f"/api/v1/registrations/{rid}/approve", headers=_csrf(client))
    ).status_code == 409


async def test_capacity_waitlists(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    did = await _division(client, tid, capacity=1)
    await _open_registration(client, tid)
    ids = []
    for _ in range(2):
        r = await client.post(
            f"/api/v1/divisions/{did}/registrations",
            json={"formResponse": {}},
            headers=_csrf(client),
        )
        ids.append(r.json()["id"])
    first = await client.post(f"/api/v1/registrations/{ids[0]}/approve", headers=_csrf(client))
    second = await client.post(f"/api/v1/registrations/{ids[1]}/approve", headers=_csrf(client))
    assert first.json()["status"] == "approved"
    assert second.json()["status"] == "waitlisted" and second.json()["participantId"] is None


async def test_doubles_approval_creates_team_and_validates_roster(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    did = await _division(client, tid, ptype="pair")
    await _open_registration(client, tid)

    # a pair needs exactly 2 players — one is rejected by the sport profile
    bad = await client.post(
        f"/api/v1/divisions/{did}/registrations",
        json={"formResponse": {"teamName": "Solo", "players": [{"name": "A"}]}},
        headers=_csrf(client),
    )
    bad_approve = await client.post(
        f"/api/v1/registrations/{bad.json()['id']}/approve", headers=_csrf(client)
    )
    assert bad_approve.status_code == 422 and bad_approve.json()["code"] == "invalid_roster"

    good = await client.post(
        f"/api/v1/divisions/{did}/registrations",
        json={"formResponse": {"teamName": "Aces", "players": [{"name": "A"}, {"name": "B"}]}},
        headers=_csrf(client),
    )
    ok = await client.post(
        f"/api/v1/registrations/{good.json()['id']}/approve", headers=_csrf(client)
    )
    assert ok.status_code == 200
    parts = await client.get(f"/api/v1/divisions/{did}/participants")
    pair = next(p for p in parts.json() if p["id"] == ok.json()["participantId"])
    assert pair["kind"] == "pair" and pair["teamId"] and pair["displayName"] == "Aces"


# ---- 3. draw generation + persistence ----


async def test_round_robin_draw_persists_full_schedule(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    did = await _division(client, tid)
    sid = await _stage(client, did, "round_robin")
    await _open_registration(client, tid)
    await _approved_entrants(client, did, 4)

    draw = await client.post(
        f"/api/v1/stages/{sid}/draw", json={"overrideReadiness": True}, headers=_csrf(client)
    )
    assert draw.status_code == 201, draw.text
    body = draw.json()
    assert body["format"] == "round_robin"
    assert body["matches"] == 6 and body["scheduled"] == 6 and body["pending"] == 0  # C(4,2)

    stages = await client.get(f"/api/v1/divisions/{did}/stages")
    assert stages.json()[0]["drawn"] is True
    # a second draw is rejected
    assert (
        await client.post(
            f"/api/v1/stages/{sid}/draw", json={"overrideReadiness": True}, headers=_csrf(client)
        )
    ).status_code == 409


async def test_single_elimination_draw_has_pending_and_byes(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    did = await _division(client, tid)
    sid = await _stage(client, did, "single_elim")
    await _open_registration(client, tid)
    await _approved_entrants(client, did, 3)  # bracket of 4 → 1 bye

    draw = await client.post(
        f"/api/v1/stages/{sid}/draw", json={"overrideReadiness": True}, headers=_csrf(client)
    )
    assert draw.status_code == 201, draw.text
    body = draw.json()
    # 3 matches total; only the real semifinal is scheduled, bye-match + final are pending
    assert body["matches"] == 3 and body["scheduled"] == 1 and body["pending"] == 2


async def test_draw_requires_enough_participants(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    did = await _division(client, tid)
    sid = await _stage(client, did, "round_robin")
    await _open_registration(client, tid)
    await _approved_entrants(client, did, 1)
    resp = await client.post(
        f"/api/v1/stages/{sid}/draw", json={"overrideReadiness": True}, headers=_csrf(client)
    )
    assert resp.status_code == 422 and resp.json()["code"] == "too_few_participants"


def _win_payload(sides: list[dict], winner_participant_id: str) -> dict:
    side0_wins = sides[0]["participantId"] == winner_participant_id
    games = [[21, 10], [21, 12]] if side0_wins else [[10, 21], [12, 21]]
    return {"games": games, "endedBy": "normal"}


async def _score(client: AsyncClient, match_id: str, payload: dict) -> tuple[int, dict]:
    resp = await client.post(
        f"/api/v1/matches/{match_id}/score", json={"payload": payload}, headers=_csrf(client)
    )
    return resp.status_code, resp.json()


async def test_matches_expose_round_and_group_labels(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    did = await _division(client, tid)
    sid = await _stage(client, did, "single_elim")
    await _open_registration(client, tid)
    await _approved_entrants(client, did, 4)
    draw = await client.post(
        f"/api/v1/stages/{sid}/draw", json={"overrideReadiness": True}, headers=_csrf(client)
    )
    assert draw.status_code == 201, draw.text

    matches = (await client.get(f"/api/v1/stages/{sid}/matches")).json()
    assert len(matches) == 3
    labels = {m["roundLabel"] for m in matches}
    assert labels == {"Semifinal", "Final"}
    assert all(m["roundSeq"] is not None for m in matches)


async def test_clear_draw_then_regenerate(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    did = await _division(client, tid)
    sid = await _stage(client, did, "round_robin")
    await _open_registration(client, tid)
    await _approved_entrants(client, did, 4)
    await client.post(
        f"/api/v1/stages/{sid}/draw", json={"overrideReadiness": True}, headers=_csrf(client)
    )

    stage_before = (await client.get(f"/api/v1/divisions/{did}/stages")).json()[0]
    assert stage_before["drawn"] is True and stage_before["locked"] is False

    cleared = await client.delete(f"/api/v1/stages/{sid}/draw", headers=_csrf(client))
    assert cleared.status_code == 204, cleared.text

    stage_after = (await client.get(f"/api/v1/divisions/{did}/stages")).json()[0]
    assert stage_after["drawn"] is False

    redrawn = await client.post(
        f"/api/v1/stages/{sid}/draw", json={"overrideReadiness": True}, headers=_csrf(client)
    )
    assert redrawn.status_code == 201, redrawn.text


async def test_clear_draw_rejects_undrawn_stage(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    did = await _division(client, tid)
    sid = await _stage(client, did, "round_robin")
    resp = await client.delete(f"/api/v1/stages/{sid}/draw", headers=_csrf(client))
    assert resp.status_code == 409


async def test_clear_draw_blocked_once_a_match_is_scored(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    did = await _division(client, tid)
    sid = await _stage(client, did, "round_robin")
    await _open_registration(client, tid)
    await _approved_entrants(client, did, 4)
    await client.post(
        f"/api/v1/stages/{sid}/draw", json={"overrideReadiness": True}, headers=_csrf(client)
    )

    matches = (await client.get(f"/api/v1/stages/{sid}/matches")).json()
    winner = matches[0]["sides"][0]["participantId"]
    status, _body = await _score(
        client, matches[0]["id"], _win_payload(matches[0]["sides"], winner)
    )
    assert status == 200

    stage = (await client.get(f"/api/v1/divisions/{did}/stages")).json()[0]
    assert stage["locked"] is True

    resp = await client.delete(f"/api/v1/stages/{sid}/draw", headers=_csrf(client))
    assert resp.status_code == 409


async def test_publish_sets_gate(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    resp = await client.post(
        f"{TOUR}/{tid}/publish", json={"artifacts": ["draw"]}, headers=_csrf(client)
    )
    assert resp.status_code == 200 and resp.json()["drawPublishedAt"]


# ---- authorization + org isolation ----


async def test_create_requires_auth(app, client):
    assert (
        await client.post(TOUR, json={"name": "X", "slug": _slug(), "sportKey": "badminton"})
    ).status_code == 401


async def test_viewer_cannot_create_tournament(app, client):
    recorder_holder: dict = {}

    class Recorder:
        def __init__(self) -> None:
            self.sent: list[dict] = []

        async def send(self, to: str, template: str, data: dict) -> str:
            self.sent.append({"to": to, "template": template, "data": data})
            return "rec"

    recorder = Recorder()
    app.dependency_overrides[get_email_channel] = lambda: recorder
    recorder_holder["r"] = recorder

    await _new_org(client)  # owner
    invitee = _email()
    inv = await client.post(
        f"{ORGS}/active/invites", json={"email": invitee, "role": "viewer"}, headers=_csrf(client)
    )
    assert inv.status_code == 201
    token = recorder.sent[-1]["data"]["token"]

    async with _client(app) as viewer:
        await viewer.post(
            f"{AUTH}/register", json={"email": invitee, "name": "V", "password": PASSWORD}
        )
        await viewer.post(f"{AUTH}/login", json={"email": invitee, "password": PASSWORD})
        await viewer.post(f"{ORGS}/invites/accept", json={"token": token}, headers=_csrf(viewer))
        resp = await viewer.post(
            TOUR,
            json={"name": "X", "slug": _slug(), "sportKey": "badminton"},
            headers=_csrf(viewer),
        )
        assert resp.status_code == 403


async def test_organization_isolation(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    async with _client(app) as other:
        await _new_org(other)  # a different org
        resp = await other.get(f"{TOUR}/{tid}")
        assert resp.status_code == 404  # cannot see another org's tournament


# ---- Match Center: tournament-wide activity timeline ----


async def test_tournament_activity_spans_every_owned_entity(app, client):
    await _new_org(client)
    me = (await client.get(f"{AUTH}/me")).json()
    tid = await _tournament(client)
    did = await _division(client, tid)
    sid = await _stage(client, did, "round_robin")
    await _open_registration(client, tid)
    await _approved_entrants(client, did, 3)
    await client.post(
        f"/api/v1/stages/{sid}/draw", json={"overrideReadiness": True}, headers=_csrf(client)
    )
    matches = (await client.get(f"/api/v1/stages/{sid}/matches")).json()
    winner = matches[0]["sides"][0]["participantId"]
    assert (await _score(client, matches[0]["id"], _win_payload(matches[0]["sides"], winner)))[
        0
    ] == 200

    resp = await client.get(f"{TOUR}/{tid}/activity")
    assert resp.status_code == 200, resp.text
    events = resp.json()
    actions = {e["action"] for e in events}
    assert {"tournament.created", "division.created", "stage.created", "stage.generated"} <= actions
    assert "match.completed" in actions

    match_completed = next(e for e in events if e["action"] == "match.completed")
    assert match_completed["entity"] == "match"
    assert match_completed["actorId"] == me["id"]  # was hardcoded None before this milestone

    # Newest first.
    assert events == sorted(events, key=lambda e: e["createdAt"], reverse=True)


async def test_tournament_activity_excludes_other_tournaments(app, client):
    await _new_org(client)
    tid_a = await _tournament(client)
    tid_b = await _tournament(client)
    did_b = await _division(client, tid_b)

    activity_a = (await client.get(f"{TOUR}/{tid_a}/activity")).json()
    assert all(e["entityId"] != did_b for e in activity_a)
    assert not any(e["action"] == "division.created" for e in activity_a)


async def test_tournament_activity_requires_org_membership(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    async with _client(app) as other:
        await _new_org(other)
        assert (await other.get(f"{TOUR}/{tid}/activity")).status_code == 404


async def test_delete_tournament_soft_hides_from_list(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    slug = (await client.get(f"{TOUR}/{tid}")).json()["slug"]

    assert (await client.delete(f"{TOUR}/{tid}", headers=_csrf(client))).status_code == 204
    assert (await client.get(f"{TOUR}/{tid}")).status_code == 404
    ids = {t["id"] for t in (await client.get(TOUR)).json()}
    assert tid not in ids

    # Slug can be reused after soft delete.
    resp = await client.post(
        TOUR, json={"name": "Again", "slug": slug, "sportKey": "badminton"}, headers=_csrf(client)
    )
    assert resp.status_code == 201, resp.text


# ---- purge (irreversible hard delete) ----


async def test_purge_removes_the_tournament_and_its_data(app, client, db_session):
    """The hard part is participants → squads, which is RESTRICT: a squad may not
    vanish while a participant still points at it, so the cascade from `tournaments`
    cannot resolve that edge alone. Build exactly that shape before purging."""
    from sqlalchemy import func, select

    from app.db.enums import ParticipantKind, ParticipantStatus
    from app.db.models import Division, Participant, Squad, Tournament

    await _new_org(client)
    tid = await _tournament(client)
    did = await _division(client, tid)
    await _stage(client, did)

    squad = (
        await client.post(f"{TOUR}/{tid}/squads", json={"name": "Team 1"}, headers=_csrf(client))
    ).json()
    division = (
        await db_session.execute(select(Division).where(Division.id == uuid.UUID(did)))
    ).scalar_one()
    db_session.add(
        Participant(
            organization_id=division.organization_id,
            division_id=division.id,
            kind=ParticipantKind.SQUAD.value,
            squad_id=uuid.UUID(squad["id"]),
            display_name="Team 1",
            status=ParticipantStatus.APPROVED.value,
        )
    )
    await db_session.commit()

    name = (await client.get(f"{TOUR}/{tid}")).json()["name"]
    assert (await client.delete(f"{TOUR}/{tid}", headers=_csrf(client))).status_code == 204

    resp = await client.post(
        f"{TOUR}/{tid}/purge", json={"confirmName": name}, headers=_csrf(client)
    )
    assert resp.status_code == 204, resp.text

    # The children go with it — a soft delete would have left these behind.
    divisions = await db_session.execute(
        select(func.count()).select_from(Division).where(Division.tournament_id == uuid.UUID(tid))
    )
    assert divisions.scalar_one() == 0
    participants = await db_session.execute(
        select(func.count())
        .select_from(Participant)
        .where(Participant.division_id == uuid.UUID(did))
    )
    assert participants.scalar_one() == 0
    squads = await db_session.execute(
        select(func.count()).select_from(Squad).where(Squad.tournament_id == uuid.UUID(tid))
    )
    assert squads.scalar_one() == 0
    gone = await db_session.execute(
        select(func.count()).select_from(Tournament).where(Tournament.id == uuid.UUID(tid))
    )
    assert gone.scalar_one() == 0


async def test_purge_refuses_a_tournament_that_is_still_live(app, client):
    """Purge only ever follows a delete — it is not a shortcut past it."""
    await _new_org(client)
    tid = await _tournament(client)
    name = (await client.get(f"{TOUR}/{tid}")).json()["name"]

    resp = await client.post(
        f"{TOUR}/{tid}/purge", json={"confirmName": name}, headers=_csrf(client)
    )
    assert resp.status_code == 404, resp.text
    assert (await client.get(f"{TOUR}/{tid}")).status_code == 200


async def test_purge_refuses_a_mismatched_name(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    await client.delete(f"{TOUR}/{tid}", headers=_csrf(client))

    resp = await client.post(
        f"{TOUR}/{tid}/purge", json={"confirmName": "not the name"}, headers=_csrf(client)
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["code"] == "purge_name_mismatch"

    # Still there, still purgeable once the name is right.
    ok = await client.post(
        f"{TOUR}/{tid}/purge", json={"confirmName": "SIBL"}, headers=_csrf(client)
    )
    assert ok.status_code == 204, ok.text


async def test_purge_cannot_reach_another_orgs_tournament(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    await client.delete(f"{TOUR}/{tid}", headers=_csrf(client))

    async with _client(app) as other:
        await _new_org(other)
        resp = await other.post(
            f"{TOUR}/{tid}/purge", json={"confirmName": "SIBL"}, headers=_csrf(other)
        )
        assert resp.status_code == 404, resp.text
