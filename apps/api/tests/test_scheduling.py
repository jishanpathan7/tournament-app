"""Match scheduling — assign/move/unschedule, conflict detection, bulk scheduling,
the organizer queue, realtime, and permissions. DB-backed (skips without a database)."""

from __future__ import annotations

import datetime
import os
import secrets
import uuid

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.factory import get_broadcaster
from app.realtime.channels import org_channel

DATABASE_URL = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not set")

PASSWORD = secrets.token_urlsafe(16)
AUTH = "/api/v1/auth"
ORGS = "/api/v1/orgs"
TOUR = "/api/v1/tournaments"

START = datetime.datetime(2026, 7, 25, 8, 0, tzinfo=datetime.timezone.utc)


def _client(app: FastAPI) -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _email() -> str:
    return f"u-{uuid.uuid4().hex[:12]}@example.com"


def _slug() -> str:
    return f"s-{uuid.uuid4().hex[:10]}"


def _csrf(client: AsyncClient) -> dict[str, str]:
    return {"X-CSRF-Token": client.cookies.get("csrf_token") or ""}


def _iso(dt: datetime.datetime) -> str:
    return dt.isoformat()


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


async def _stage(client: AsyncClient, did: str, fmt: str = "round_robin") -> str:
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


async def _venue_and_court(client: AsyncClient, name: str = "Court 1") -> str:
    venue = await client.post("/api/v1/venues", json={"name": "Gym"}, headers=_csrf(client))
    assert venue.status_code == 201, venue.text
    court = await client.post(
        "/api/v1/courts", json={"venueId": venue.json()["id"], "name": name}, headers=_csrf(client)
    )
    assert court.status_code == 201, court.text
    return court.json()["id"]


async def _assign_court_to_tournament(client: AsyncClient, tid: str, court_id: str) -> None:
    resp = await client.post(
        f"{TOUR}/{tid}/courts", json={"courtId": court_id}, headers=_csrf(client)
    )
    assert resp.status_code == 201, resp.text


async def _bracket(client: AsyncClient, entrants: int = 3) -> tuple[str, str, str]:
    """Register+login a fresh org, then tournament→division→stage, approve, draw+publish.
    Returns (tid, did, sid)."""
    await _new_org(client)
    tid = await _tournament(client)
    did = await _division(client, tid)
    sid = await _stage(client, did)
    await _open_registration(client, tid)
    await _approved_entrants(client, did, entrants)
    draw = await client.post(f"/api/v1/stages/{sid}/draw", json={"overrideReadiness": True}, headers=_csrf(client))
    assert draw.status_code == 201, draw.text
    await client.post(f"{TOUR}/{tid}/publish", json={"artifacts": ["draw"]}, headers=_csrf(client))
    return tid, did, sid


async def _matches(client: AsyncClient, sid: str) -> list[dict]:
    resp = await client.get(f"/api/v1/stages/{sid}/matches")
    assert resp.status_code == 200, resp.text
    return resp.json()


# ---- assign / move / unschedule ----


async def test_assign_court_and_time_to_a_match(app, client):
    tid, _did, sid = await _bracket(client)
    court_id = await _venue_and_court(client)
    await _assign_court_to_tournament(client, tid, court_id)
    match = (await _matches(client, sid))[0]

    resp = await client.patch(
        f"/api/v1/matches/{match['id']}/schedule",
        json={"courtId": court_id, "scheduledAt": _iso(START), "durationMinutes": 30},
        headers=_csrf(client),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["match"]["courtId"] == court_id
    assert body["conflicts"] == []


async def test_reschedule_moves_court_and_time(app, client):
    tid, _did, sid = await _bracket(client)
    court_a = await _venue_and_court(client, "Court A")
    court_b = await _venue_and_court(client, "Court B")
    await _assign_court_to_tournament(client, tid, court_a)
    await _assign_court_to_tournament(client, tid, court_b)
    match = (await _matches(client, sid))[0]

    await client.patch(
        f"/api/v1/matches/{match['id']}/schedule",
        json={"courtId": court_a, "scheduledAt": _iso(START), "durationMinutes": 30},
        headers=_csrf(client),
    )
    later = START + datetime.timedelta(hours=2)
    moved = await client.patch(
        f"/api/v1/matches/{match['id']}/schedule",
        json={"courtId": court_b, "scheduledAt": _iso(later), "durationMinutes": 45},
        headers=_csrf(client),
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["match"]["courtId"] == court_b


async def test_unschedule_clears_court_and_time(app, client):
    tid, _did, sid = await _bracket(client)
    court_id = await _venue_and_court(client)
    await _assign_court_to_tournament(client, tid, court_id)
    match = (await _matches(client, sid))[0]
    await client.patch(
        f"/api/v1/matches/{match['id']}/schedule",
        json={"courtId": court_id, "scheduledAt": _iso(START), "durationMinutes": 30},
        headers=_csrf(client),
    )

    resp = await client.delete(f"/api/v1/matches/{match['id']}/schedule", headers=_csrf(client))
    assert resp.status_code == 200, resp.text
    assert resp.json()["courtId"] is None
    assert resp.json()["scheduledAt"] is None


# ---- hard conflicts (block the save) ----


async def test_assign_rejects_court_not_assigned_to_tournament(app, client):
    _tid, _did, sid = await _bracket(client)
    court_id = await _venue_and_court(client)  # never assigned to the tournament
    match = (await _matches(client, sid))[0]

    resp = await client.patch(
        f"/api/v1/matches/{match['id']}/schedule",
        json={"courtId": court_id, "scheduledAt": _iso(START), "durationMinutes": 30},
        headers=_csrf(client),
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "schedule_conflict"


async def test_assign_rejects_disabled_court(app, client):
    tid, _did, sid = await _bracket(client)
    court_id = await _venue_and_court(client)
    await _assign_court_to_tournament(client, tid, court_id)
    await client.patch(
        f"/api/v1/courts/{court_id}", json={"status": "disabled"}, headers=_csrf(client)
    )
    match = (await _matches(client, sid))[0]

    resp = await client.patch(
        f"/api/v1/matches/{match['id']}/schedule",
        json={"courtId": court_id, "scheduledAt": _iso(START), "durationMinutes": 30},
        headers=_csrf(client),
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "schedule_conflict"


async def test_assign_rejects_unresolved_pending_match(app, client):
    tid, _did, sid = await _bracket(client, entrants=4)
    court_id = await _venue_and_court(client)
    await _assign_court_to_tournament(client, tid, court_id)
    # single-elim would have a pending final; round-robin has none pending, so switch
    # to a fresh single-elim bracket for this one.
    await _new_org(client)
    tid2 = await _tournament(client)
    did2 = await _division(client, tid2)
    sid2 = await _stage(client, did2, "single_elim")
    await _open_registration(client, tid2)
    await _approved_entrants(client, did2, 4)
    await client.post(f"/api/v1/stages/{sid2}/draw", json={"overrideReadiness": True}, headers=_csrf(client))
    court_id2 = await _venue_and_court(client, "Court 2")
    await _assign_court_to_tournament(client, tid2, court_id2)
    matches = await _matches(client, sid2)
    final = next(m for m in matches if m["status"] == "pending")

    resp = await client.patch(
        f"/api/v1/matches/{final['id']}/schedule",
        json={"courtId": court_id2, "scheduledAt": _iso(START), "durationMinutes": 30},
        headers=_csrf(client),
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "schedule_conflict"


async def test_assign_rejects_outside_tournament_window(app, client):
    tid, _did, sid = await _bracket(client)
    court_id = await _venue_and_court(client)
    await _assign_court_to_tournament(client, tid, court_id)
    await client.patch(
        f"{TOUR}/{tid}",
        json={"startsAt": _iso(START), "endsAt": _iso(START + datetime.timedelta(hours=4))},
        headers=_csrf(client),
    )
    match = (await _matches(client, sid))[0]

    too_early = START - datetime.timedelta(hours=1)
    resp = await client.patch(
        f"/api/v1/matches/{match['id']}/schedule",
        json={"courtId": court_id, "scheduledAt": _iso(too_early), "durationMinutes": 30},
        headers=_csrf(client),
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "schedule_conflict"


# ---- soft conflicts (surfaced, never block) ----


async def test_check_endpoint_reports_conflicts_without_mutating(app, client):
    tid, _did, sid = await _bracket(client)
    court_id = await _venue_and_court(client)
    await _assign_court_to_tournament(client, tid, court_id)
    match = (await _matches(client, sid))[0]

    resp = await client.post(
        f"/api/v1/matches/{match['id']}/schedule/check",
        json={"courtId": court_id, "scheduledAt": _iso(START), "durationMinutes": 30},
        headers=_csrf(client),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["conflicts"] == []

    unchanged = (await _matches(client, sid))[0]
    assert unchanged["courtId"] is None  # check() never saves


async def test_court_overlap_is_a_soft_conflict_that_still_saves(app, client):
    tid, _did, sid = await _bracket(client)
    court_id = await _venue_and_court(client)
    await _assign_court_to_tournament(client, tid, court_id)
    matches = await _matches(client, sid)

    await client.patch(
        f"/api/v1/matches/{matches[0]['id']}/schedule",
        json={"courtId": court_id, "scheduledAt": _iso(START), "durationMinutes": 30},
        headers=_csrf(client),
    )
    # Same court, overlapping window.
    resp = await client.patch(
        f"/api/v1/matches/{matches[1]['id']}/schedule",
        json={"courtId": court_id, "scheduledAt": _iso(START), "durationMinutes": 30},
        headers=_csrf(client),
    )
    assert resp.status_code == 200, resp.text
    kinds = {c["kind"] for c in resp.json()["conflicts"]}
    assert "court_overlap" in kinds
    assert resp.json()["match"]["courtId"] == court_id  # saved despite the warning


async def test_participant_overlap_is_a_soft_conflict(app, client):
    tid, did, sid = await _bracket(client, entrants=3)
    court_a = await _venue_and_court(client, "Court A")
    court_b = await _venue_and_court(client, "Court B")
    await _assign_court_to_tournament(client, tid, court_a)
    await _assign_court_to_tournament(client, tid, court_b)
    matches = await _matches(client, sid)
    shared_participant = matches[0]["sides"][0]["participantId"]
    other_match = next(
        m
        for m in matches
        if m["id"] != matches[0]["id"]
        and any(s["participantId"] == shared_participant for s in m["sides"])
    )

    await client.patch(
        f"/api/v1/matches/{matches[0]['id']}/schedule",
        json={"courtId": court_a, "scheduledAt": _iso(START), "durationMinutes": 30},
        headers=_csrf(client),
    )
    resp = await client.patch(
        f"/api/v1/matches/{other_match['id']}/schedule",
        json={"courtId": court_b, "scheduledAt": _iso(START), "durationMinutes": 30},
        headers=_csrf(client),
    )
    assert resp.status_code == 200, resp.text
    kinds = {c["kind"] for c in resp.json()["conflicts"]}
    assert "participant_overlap" in kinds


# ---- bulk scheduling ----


async def test_bulk_assign_is_all_or_nothing(app, client):
    tid, _did, sid = await _bracket(client)
    court_id = await _venue_and_court(client)
    await _assign_court_to_tournament(client, tid, court_id)
    unassigned_court_id = await _venue_and_court(client, "Court X")  # not assigned
    matches = await _matches(client, sid)

    resp = await client.post(
        f"{TOUR}/{tid}/schedule/bulk",
        json={
            "assignments": [
                {
                    "matchId": matches[0]["id"],
                    "courtId": court_id,
                    "scheduledAt": _iso(START),
                    "durationMinutes": 30,
                },
                {
                    "matchId": matches[1]["id"],
                    "courtId": unassigned_court_id,
                    "scheduledAt": _iso(START),
                    "durationMinutes": 30,
                },
            ]
        },
        headers=_csrf(client),
    )
    assert resp.status_code == 422

    # The whole batch rolled back — the first item's assignment did not stick either.
    reloaded = await _matches(client, sid)
    assert all(m["courtId"] is None for m in reloaded)


async def test_bulk_assign_applies_every_item_on_success(app, client):
    tid, _did, sid = await _bracket(client)
    court_id = await _venue_and_court(client)
    await _assign_court_to_tournament(client, tid, court_id)
    matches = await _matches(client, sid)

    resp = await client.post(
        f"{TOUR}/{tid}/schedule/bulk",
        json={
            "assignments": [
                {
                    "matchId": m["id"],
                    "courtId": court_id,
                    "scheduledAt": _iso(START + datetime.timedelta(hours=i)),
                    "durationMinutes": 30,
                }
                for i, m in enumerate(matches)
            ]
        },
        headers=_csrf(client),
    )
    assert resp.status_code == 200, resp.text
    assert len(resp.json()["results"]) == len(matches)
    reloaded = await _matches(client, sid)
    assert all(m["courtId"] == court_id for m in reloaded)


# ---- queue ----


async def test_queue_reports_current_match_and_free_courts(app, client):
    tid, _did, sid = await _bracket(client)
    court_busy = await _venue_and_court(client, "Court A")
    court_free = await _venue_and_court(client, "Court B")
    await _assign_court_to_tournament(client, tid, court_busy)
    await _assign_court_to_tournament(client, tid, court_free)
    match = (await _matches(client, sid))[0]
    await client.patch(
        f"/api/v1/matches/{match['id']}/schedule",
        json={"courtId": court_busy, "scheduledAt": _iso(START), "durationMinutes": 30},
        headers=_csrf(client),
    )

    resp = await client.get(f"{TOUR}/{tid}/schedule/queue")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    by_court = {c["court"]["id"]: c for c in body["courts"]}
    assert by_court[court_busy]["currentMatch"]["id"] == match["id"]
    assert by_court[court_free]["currentMatch"] is None
    # The other two round-robin matches have no court/time yet.
    assert len(body["unscheduled"]) == 2


# ---- realtime + permissions + isolation ----


async def test_schedule_change_emits_realtime_event(app, client):
    org_id = await _new_org(client)
    tid = await _tournament(client)
    did = await _division(client, tid)
    sid = await _stage(client, did)
    await _open_registration(client, tid)
    await _approved_entrants(client, did, 3)
    await client.post(f"/api/v1/stages/{sid}/draw", json={"overrideReadiness": True}, headers=_csrf(client))
    court_id = await _venue_and_court(client)
    await _assign_court_to_tournament(client, tid, court_id)
    match = (await _matches(client, sid))[0]

    received: list[dict] = []

    async def _collect() -> None:
        gen = get_broadcaster().subscribe(org_channel(uuid.UUID(org_id)))
        try:
            async for event in gen:
                received.append(event)
                return
        finally:
            await gen.aclose()

    import asyncio

    task = asyncio.create_task(_collect())
    await asyncio.sleep(0.05)
    resp = await client.patch(
        f"/api/v1/matches/{match['id']}/schedule",
        json={"courtId": court_id, "scheduledAt": _iso(START), "durationMinutes": 30},
        headers=_csrf(client),
    )
    assert resp.status_code == 200, resp.text
    await asyncio.wait_for(task, timeout=3)

    assert received[0]["type"] == "schedule.updated"


async def test_scheduling_requires_auth(app, client):
    resp = await client.patch(
        f"/api/v1/matches/{uuid.uuid4()}/schedule",
        json={"courtId": str(uuid.uuid4()), "scheduledAt": _iso(START), "durationMinutes": 30},
    )
    assert resp.status_code == 401


async def test_organization_isolation_on_schedule(app, client):
    _tid, _did, sid = await _bracket(client)
    match = (await _matches(client, sid))[0]

    async with _client(app) as other:
        await _new_org(other)
        resp = await other.patch(
            f"/api/v1/matches/{match['id']}/schedule",
            json={"courtId": str(uuid.uuid4()), "scheduledAt": _iso(START), "durationMinutes": 30},
            headers=_csrf(other),
        )
        assert resp.status_code == 404
