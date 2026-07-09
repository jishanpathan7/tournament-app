"""Scoring + advancement + standings integration tests — the full competition lifecycle.

Drives everything through the HTTP API (which commits), so the async worker can pick up
the ``standings.recompute`` outbox event in its own session. Covers: score submission +
validation via the Sport Profile, ETag optimistic concurrency, Idempotency-Key replay,
score corrections + the winner-change guard, walkovers, invalid submissions, single-elim
advancement to a champion (auto-activation of the next match), round-robin standings
recomputation, realtime events, notification dispatch, authorization, and org isolation.
DB-backed (skips without a database)."""

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
from app.workers import poller

DATABASE_URL = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not set")


async def _drain_outbox() -> None:
    """Fully drain pending outbox jobs rather than a fixed batch size — the shared test
    DB accumulates other tests' undrained events (nothing else in the suite needs the
    async recompute to finish, so nothing else bothers draining), and a fixed
    `batch_size` can leave THIS test's own event stuck behind an arbitrarily large
    backlog it has no control over."""
    while await poller.process_pending(batch_size=200, max_attempts=5):
        pass


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


async def _division(client: AsyncClient, tid: str) -> str:
    resp = await client.post(
        f"{TOUR}/{tid}/divisions",
        json={"name": "Div", "participantType": "individual"},
        headers=_csrf(client),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _stage(client: AsyncClient, did: str, fmt: str) -> str:
    resp = await client.post(
        f"/api/v1/divisions/{did}/stages", json={"type": fmt, "seq": 1}, headers=_csrf(client)
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
        assert approve.status_code == 200, approve.text


async def _bracket(client: AsyncClient, fmt: str, entrants: int) -> tuple[str, str, str]:
    """Register+login a fresh org, then tournament→division→stage, approve, draw.
    Returns (tid, did, sid)."""
    await _new_org(client)
    tid = await _tournament(client)
    did = await _division(client, tid)
    sid = await _stage(client, did, fmt)
    await _open_registration(client, tid)
    await _approved_entrants(client, did, entrants)
    draw = await client.post(
        f"/api/v1/stages/{sid}/draw", json={"overrideReadiness": True}, headers=_csrf(client)
    )
    assert draw.status_code == 201, draw.text
    return tid, did, sid


async def _matches(client: AsyncClient, sid: str) -> list[dict]:
    resp = await client.get(f"/api/v1/stages/{sid}/matches")
    assert resp.status_code == 200, resp.text
    return resp.json()


def _win_payload(sides: list[dict], winner_participant_id: str) -> dict:
    """A normal 2-0 result where the named participant wins (side order is stable)."""
    side0_wins = sides[0]["participantId"] == winner_participant_id
    games = [[21, 10], [21, 12]] if side0_wins else [[10, 21], [12, 21]]
    return {"games": games, "endedBy": "normal"}


async def _score(
    client: AsyncClient, match_id: str, payload: dict, **headers: str
) -> "tuple[int, object]":
    resp = await client.post(
        f"/api/v1/matches/{match_id}/score",
        json={"payload": payload},
        headers={**_csrf(client), **headers},
    )
    return resp.status_code, resp


async def _start(client: AsyncClient, match_id: str, **headers: str) -> "tuple[int, object]":
    resp = await client.post(
        f"/api/v1/matches/{match_id}/start",
        headers={**_csrf(client), **headers},
    )
    return resp.status_code, resp


# ---- start match (scheduled → live) ----


async def test_start_match_transitions_scheduled_to_live(app, client):
    _tid, _did, sid = await _bracket(client, "round_robin", 2)
    matches = await _matches(client, sid)
    match = matches[0]
    assert match["status"] == "scheduled"

    status, resp = await _start(client, match["id"])
    assert status == 200, resp.text
    assert resp.json()["status"] == "live"

    # Idempotent second call
    status2, resp2 = await _start(client, match["id"])
    assert status2 == 200, resp2.text
    assert resp2.json()["status"] == "live"

    # Final score still completes from live
    winner = match["sides"][0]["participantId"]
    status3, resp3 = await _score(client, match["id"], _win_payload(match["sides"], winner))
    assert status3 == 200, resp3.text
    assert resp3.json()["status"] == "completed"


async def test_start_match_rejects_completed(app, client):
    _tid, _did, sid = await _bracket(client, "round_robin", 2)
    matches = await _matches(client, sid)
    match = matches[0]
    winner = match["sides"][0]["participantId"]
    await _score(client, match["id"], _win_payload(match["sides"], winner))

    status, resp = await _start(client, match["id"])
    assert status == 422, resp.text
    body = resp.json()
    assert body.get("code") == "not_startable"


# ---- 1. round robin → standings ----


async def test_round_robin_scoring_recomputes_standings(app, client):
    _tid, _did, sid = await _bracket(client, "round_robin", 3)  # 3 matches, everyone plays 2
    matches = await _matches(client, sid)
    assert len(matches) == 3

    # Impose a strict order: the globally lowest participant id always wins.
    priority = sorted({s["participantId"] for m in matches for s in m["sides"]})
    for m in matches:
        winner = min((s["participantId"] for s in m["sides"]), key=priority.index)
        status, resp = await _score(client, m["id"], _win_payload(m["sides"], winner))
        assert status == 200, resp.text
        assert resp.json()["status"] == "completed"

    # Standings are recomputed asynchronously by the worker.
    await _drain_outbox()

    standings = await client.get(f"/api/v1/stages/{sid}/standings")
    assert standings.status_code == 200, standings.text
    rows = standings.json()["rows"]
    assert len(rows) == 3
    assert [r["rank"] for r in rows] == [1, 2, 3]  # deterministic, no ties
    assert rows[0]["participantId"] == priority[0]  # top seed swept its matches
    assert rows[0]["won"] == 2 and rows[0]["points"] == 2.0
    assert rows[-1]["won"] == 0 and rows[-1]["played"] == 2


async def test_partial_standings_count_only_completed_matches(app, client):
    _tid, _did, sid = await _bracket(client, "round_robin", 3)
    matches = await _matches(client, sid)
    winner = matches[0]["sides"][0]["participantId"]
    status, resp = await _score(client, matches[0]["id"], _win_payload(matches[0]["sides"], winner))
    assert status == 200
    await _drain_outbox()

    rows = (await client.get(f"/api/v1/stages/{sid}/standings")).json()["rows"]
    assert sum(r["played"] for r in rows) == 2  # only the one completed match counts
    assert sum(r["won"] for r in rows) == 1


# ---- 2. single elimination → advancement to a champion ----


async def test_single_elimination_advances_to_champion(app, client):
    _tid, _did, sid = await _bracket(client, "single_elim", 4)  # 2 semis + 1 final, no byes
    matches = await _matches(client, sid)
    semis = [m for m in matches if m["status"] == "scheduled"]
    final = next(m for m in matches if m["status"] == "pending")
    assert len(semis) == 2

    semi_winners = []
    for semi in semis:
        winner = semi["sides"][0]["participantId"]
        semi_winners.append(winner)
        status, resp = await _score(client, semi["id"], _win_payload(semi["sides"], winner))
        assert status == 200, resp.text

    # The final was pending; scoring both semis must auto-fill + schedule it.
    final_view = (await client.get(f"/api/v1/matches/{final['id']}")).json()
    assert final_view["status"] == "scheduled"
    final_ids = {s["participantId"] for s in final_view["sides"]}
    assert final_ids == set(semi_winners)

    champion = semi_winners[0]
    status, resp = await _score(client, final["id"], _win_payload(final_view["sides"], champion))
    assert status == 200, resp.text
    body = resp.json()
    assert body["status"] == "completed"
    champ_side = next(s for s in body["sides"] if s["participantId"] == champion)
    assert champ_side["outcome"] == "win"


# ---- 3. idempotency + optimistic concurrency ----


async def test_idempotency_key_replays_and_conflicts(app, client):
    _tid, _did, sid = await _bracket(client, "round_robin", 3)
    match = (await _matches(client, sid))[0]
    winner = match["sides"][0]["participantId"]
    payload = _win_payload(match["sides"], winner)
    key = uuid.uuid4().hex

    first = await client.post(
        f"/api/v1/matches/{match['id']}/score",
        json={"payload": payload},
        headers={**_csrf(client), "Idempotency-Key": key},
    )
    assert first.status_code == 200

    # Same key + same body → replay (no re-processing), still completed.
    replay = await client.post(
        f"/api/v1/matches/{match['id']}/score",
        json={"payload": payload},
        headers={**_csrf(client), "Idempotency-Key": key},
    )
    assert replay.status_code == 200 and replay.json()["status"] == "completed"

    # Same key + different body → conflict.
    other = {"games": [[21, 5], [21, 6]], "endedBy": "normal"}
    conflict = await client.post(
        f"/api/v1/matches/{match['id']}/score",
        json={"payload": other},
        headers={**_csrf(client), "Idempotency-Key": key},
    )
    assert conflict.status_code == 409 and conflict.json()["code"] == "idempotency_conflict"


async def test_etag_optimistic_concurrency(app, client):
    _tid, _did, sid = await _bracket(client, "round_robin", 3)
    match = (await _matches(client, sid))[0]
    view = await client.get(f"/api/v1/matches/{match['id']}")
    etag = view.headers["ETag"]
    winner = match["sides"][0]["participantId"]
    payload = _win_payload(match["sides"], winner)

    # A stale/wrong If-Match is rejected before any change.
    stale = await client.post(
        f"/api/v1/matches/{match['id']}/score",
        json={"payload": payload},
        headers={**_csrf(client), "If-Match": 'W/"1"'},
    )
    assert stale.status_code == 412 and stale.json()["code"] == "stale_match"

    # The current ETag is accepted.
    ok = await client.post(
        f"/api/v1/matches/{match['id']}/score",
        json={"payload": payload},
        headers={**_csrf(client), "If-Match": etag},
    )
    assert ok.status_code == 200


# ---- 4. corrections + the winner-change guard ----


async def test_score_correction_same_winner_is_allowed(app, client):
    _tid, _did, sid = await _bracket(client, "round_robin", 3)
    match = (await _matches(client, sid))[0]
    winner = match["sides"][0]["participantId"]
    assert (await _score(client, match["id"], _win_payload(match["sides"], winner)))[0] == 200

    # Correct the scoreline without changing who won.
    corrected = {"games": [[21, 19], [19, 21], [21, 18]], "endedBy": "normal"}
    side0_wins = match["sides"][0]["participantId"] == winner
    if not side0_wins:
        corrected = {"games": [[19, 21], [21, 19], [18, 21]], "endedBy": "normal"}
    status, resp = await _score(client, match["id"], corrected)
    assert status == 200, resp.text
    win_side = next(s for s in resp.json()["sides"] if s["participantId"] == winner)
    assert win_side["outcome"] == "win"


async def test_winner_change_blocked_after_advancement(app, client):
    _tid, _did, sid = await _bracket(client, "single_elim", 4)
    matches = await _matches(client, sid)
    semi = next(m for m in matches if m["status"] == "scheduled")
    winner = semi["sides"][0]["participantId"]
    loser = semi["sides"][1]["participantId"]
    assert (await _score(client, semi["id"], _win_payload(semi["sides"], winner)))[0] == 200

    # The final depends on this semi's winner — flipping it is a conflict.
    status, resp = await _score(client, semi["id"], _win_payload(semi["sides"], loser))
    assert status == 409 and resp.json()["code"] == "correction_conflict"


# ---- 5. walkovers + invalid submissions ----


async def test_walkover_completes_match(app, client):
    _tid, _did, sid = await _bracket(client, "round_robin", 3)
    match = (await _matches(client, sid))[0]
    status, resp = await _score(client, match["id"], {"endedBy": "walkover", "walkoverWinner": 0})
    assert status == 200, resp.text
    body = resp.json()
    assert body["status"] == "walkover"
    assert body["sides"][0]["outcome"] == "win"


async def test_invalid_score_is_rejected(app, client):
    _tid, _did, sid = await _bracket(client, "round_robin", 3)
    match = (await _matches(client, sid))[0]
    status, resp = await _score(client, match["id"], {"games": [[5, 3]], "endedBy": "normal"})
    assert status == 422 and resp.json()["code"] == "invalid_score"


# ---- 6. realtime + notifications ----


async def test_scoring_emits_realtime_and_notifications(app, client):
    org_id = await _new_org(client)
    tid = await _tournament(client)
    did = await _division(client, tid)
    sid = await _stage(client, did, "round_robin")
    await _open_registration(client, tid)
    await _approved_entrants(client, did, 3)
    await client.post(
        f"/api/v1/stages/{sid}/draw", json={"overrideReadiness": True}, headers=_csrf(client)
    )
    match = (await _matches(client, sid))[0]
    winner = match["sides"][0]["participantId"]

    received: list[dict] = []

    async def _collect() -> None:
        gen = get_broadcaster().subscribe(org_channel(uuid.UUID(org_id)))
        try:
            async for event in gen:
                received.append(event)
                if len(received) >= 2:
                    return
        finally:
            await gen.aclose()

    task = asyncio.create_task(_collect())
    await asyncio.sleep(0.05)  # let the subscriber register
    status, resp = await _score(client, match["id"], _win_payload(match["sides"], winner))
    assert status == 200, resp.text
    await asyncio.wait_for(task, timeout=3)

    types = {e["type"] for e in received}
    assert "match.completed" in types and "bracket.updated" in types

    # In-app notifications were created for the (owner-linked) participants.
    notifs = await client.get("/api/v1/notifications")
    assert notifs.status_code == 200
    assert any(n["type"] == "match.completed" for n in notifs.json()["items"])


# ---- 7. authorization + org isolation ----


async def test_scoring_requires_auth(app, client):
    resp = await client.post(
        f"/api/v1/matches/{uuid.uuid4()}/score", json={"payload": {"endedBy": "walkover"}}
    )
    assert resp.status_code == 401


async def test_viewer_cannot_score(app, client):
    recorder_sent: list[dict] = []

    class Recorder:
        async def send(self, to: str, template: str, data: dict) -> str:
            recorder_sent.append({"to": to, "template": template, "data": data})
            return "rec"

    app.dependency_overrides[get_email_channel] = lambda: Recorder()

    _tid, _did, sid = await _bracket(client, "round_robin", 3)  # owner org + a match
    match = (await _matches(client, sid))[0]

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
        resp = await viewer.post(
            f"/api/v1/matches/{match['id']}/score",
            json={"payload": {"endedBy": "walkover", "walkoverWinner": 0}},
            headers=_csrf(viewer),
        )
        assert resp.status_code == 403


async def test_organization_isolation(app, client):
    _tid, _did, sid = await _bracket(client, "round_robin", 3)
    match = (await _matches(client, sid))[0]

    async with _client(app) as other:
        await _new_org(other)  # a different org (owner → has scoring:write)
        assert (await other.get(f"/api/v1/matches/{match['id']}")).status_code == 404
        resp = await other.post(
            f"/api/v1/matches/{match['id']}/score",
            json={"payload": {"endedBy": "walkover", "walkoverWinner": 0}},
            headers=_csrf(other),
        )
        assert resp.status_code == 404


# ---- 8. Match Center: tournament-wide match list + per-match event history ----


async def test_tournament_matches_spans_every_division(app, client):
    await _new_org(client)
    tid = await _tournament(client)
    did_a = await _division(client, tid)
    did_b = await _division(client, tid)
    sid_a = await _stage(client, did_a, "round_robin")
    sid_b = await _stage(client, did_b, "single_elim")
    await _open_registration(client, tid)
    await _approved_entrants(client, did_a, 3)
    await _approved_entrants(client, did_b, 4)
    await client.post(
        f"/api/v1/stages/{sid_a}/draw", json={"overrideReadiness": True}, headers=_csrf(client)
    )
    await client.post(
        f"/api/v1/stages/{sid_b}/draw", json={"overrideReadiness": True}, headers=_csrf(client)
    )

    resp = await client.get(f"/api/v1/tournaments/{tid}/matches")
    assert resp.status_code == 200, resp.text
    matches = resp.json()
    assert len(matches) == 3 + 3  # round robin C(3,2) + single-elim bracket-of-4
    assert {m["stageId"] for m in matches} == {sid_a, sid_b}
    # Court/scheduling fields exist on the wire even though nothing populates them yet.
    assert all(m["courtId"] is None and m["scheduledAt"] is None for m in matches)


async def test_match_events_records_submission_then_correction_with_actor(app, client):
    _tid, _did, sid = await _bracket(client, "round_robin", 3)
    match = (await _matches(client, sid))[0]
    me = (await client.get(f"{AUTH}/me")).json()

    winner = match["sides"][0]["participantId"]
    assert (await _score(client, match["id"], _win_payload(match["sides"], winner)))[0] == 200

    events_resp = await client.get(f"/api/v1/matches/{match['id']}/events")
    assert events_resp.status_code == 200, events_resp.text
    events = events_resp.json()
    assert len(events) == 1
    assert events[0]["type"] == "normal"
    assert events[0]["actorId"] == me["id"]

    corrected = {"games": [[21, 19], [19, 21], [21, 18]], "endedBy": "normal"}
    side0_wins = match["sides"][0]["participantId"] == winner
    if not side0_wins:
        corrected = {"games": [[19, 21], [21, 19], [18, 21]], "endedBy": "normal"}
    assert (await _score(client, match["id"], corrected))[0] == 200

    events = (await client.get(f"/api/v1/matches/{match['id']}/events")).json()
    assert [e["type"] for e in events] == ["normal", "correction"]
    assert events[1]["actorId"] == me["id"]


async def test_match_events_requires_org_membership(app, client):
    _tid, _did, sid = await _bracket(client, "round_robin", 3)
    match = (await _matches(client, sid))[0]

    async with _client(app) as other:
        await _new_org(other)
        assert (await other.get(f"/api/v1/matches/{match['id']}/events")).status_code == 404
