"""Public microsite — anonymous access, visibility/publication gating, PII exclusion,
cross-org isolation. DB-backed (skips without a database)."""

from __future__ import annotations

import os
import secrets
import uuid

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

DATABASE_URL = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not set")

PASSWORD = secrets.token_urlsafe(16)
AUTH = "/api/v1/auth"
ORGS = "/api/v1/orgs"
TOUR = "/api/v1/tournaments"
PUBLIC = "/api/v1/public"


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


async def _tournament(
    client: AsyncClient, visibility: str = "public", slug: str | None = None
) -> tuple[str, str]:
    slug = slug or _slug()
    resp = await client.post(
        TOUR,
        json={"name": "SIBL", "slug": slug, "sportKey": "badminton", "visibility": visibility},
        headers=_csrf(client),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"], slug


async def _division(client: AsyncClient, tid: str, ptype: str = "individual") -> str:
    resp = await client.post(
        f"{TOUR}/{tid}/divisions",
        json={"name": "Div", "participantType": ptype},
        headers=_csrf(client),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _stage(client: AsyncClient, did: str, fmt: str = "round_robin") -> str:
    resp = await client.post(
        f"/api/v1/divisions/{did}/stages", json={"type": fmt, "seq": 0}, headers=_csrf(client)
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _open_registration(client: AsyncClient, tid: str) -> None:
    resp = await client.post(
        f"{TOUR}/{tid}/status", json={"status": "registration"}, headers=_csrf(client)
    )
    assert resp.status_code == 200, resp.text


async def _approved_entrants(client: AsyncClient, did: str, n: int) -> list[str]:
    participant_ids = []
    for i in range(n):
        reg = await client.post(
            f"/api/v1/divisions/{did}/registrations",
            json={"formResponse": {"name": f"Player {i}"}},
            headers=_csrf(client),
        )
        assert reg.status_code == 201, reg.text
        approve = await client.post(
            f"/api/v1/registrations/{reg.json()['id']}/approve", headers=_csrf(client)
        )
        assert approve.status_code == 200, approve.text
        participant_ids.append(approve.json()["participantId"])
    return participant_ids


async def _publish_draw(client: AsyncClient, tid: str) -> None:
    resp = await client.post(
        f"{TOUR}/{tid}/publish", json={"artifacts": ["draw"]}, headers=_csrf(client)
    )
    assert resp.status_code == 200, resp.text


async def _win_payload_and_score(client: AsyncClient, match: dict) -> None:
    games = [[21, 10], [21, 12]]  # side 0 wins
    resp = await client.post(
        f"/api/v1/matches/{match['id']}/score",
        json={"payload": {"games": games, "endedBy": "normal"}},
        headers=_csrf(client),
    )
    assert resp.status_code == 200, resp.text


# ---- visibility gating ----


async def test_private_tournament_is_not_publicly_reachable(app, client):
    await _new_org(client)
    _tid, slug = await _tournament(client, visibility="private")
    resp = await client.get(f"{PUBLIC}/tournaments/{slug}")
    assert resp.status_code == 404


async def test_public_tournament_is_reachable_anonymously(app, client):
    await _new_org(client)
    _tid, slug = await _tournament(client, visibility="public")
    resp = await client.get(f"{PUBLIC}/tournaments/{slug}")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["slug"] == slug
    assert body["visibility"] == "public"
    assert "organization" in body and "slug" in body["organization"]


async def test_unlisted_tournament_reachable_by_slug_but_not_search(app, client):
    await _new_org(client)
    _tid, slug = await _tournament(client, visibility="unlisted")

    direct = await client.get(f"{PUBLIC}/tournaments/{slug}")
    assert direct.status_code == 200, direct.text

    results = await client.get(f"{PUBLIC}/search", params={"q": slug})
    assert results.status_code == 200
    assert all(r["slug"] != slug for r in results.json())


async def test_search_finds_public_tournaments_by_name_or_slug(app, client):
    await _new_org(client)
    _tid, slug = await _tournament(client, visibility="public")

    by_slug = await client.get(f"{PUBLIC}/search", params={"q": slug})
    assert any(r["slug"] == slug for r in by_slug.json())

    by_name = await client.get(f"{PUBLIC}/search", params={"q": "SIBL"})
    assert any(r["slug"] == slug for r in by_name.json())


async def test_anonymous_read_requires_no_cookies_at_all(app):
    """A brand-new client with zero cookies — the real "anonymous visitor" shape."""
    async with _client(app) as anon:
        resp = await anon.get(f"{PUBLIC}/search", params={"q": "anything"})
        assert resp.status_code == 200


# ---- divisions/stages/participants visible before the draw is published ----


async def test_divisions_and_participants_visible_before_draw_published(app, client):
    await _new_org(client)
    tid, slug = await _tournament(client, visibility="public")
    did = await _division(client, tid)
    await _stage(client, did)
    await _open_registration(client, tid)
    await _approved_entrants(client, did, 3)

    divisions = await client.get(f"{PUBLIC}/tournaments/{slug}/divisions")
    assert divisions.status_code == 200
    assert len(divisions.json()) == 1
    assert divisions.json()[0]["approvedCount"] == 3

    participants = await client.get(f"{PUBLIC}/tournaments/{slug}/participants")
    assert participants.status_code == 200
    assert len(participants.json()) == 3
    # Never PII: only id/divisionId/kind/displayName/seed on the wire.
    assert set(participants.json()[0].keys()) == {"id", "divisionId", "kind", "displayName", "seed"}

    stages = await client.get(f"{PUBLIC}/tournaments/{slug}/stages")
    assert stages.status_code == 200
    assert stages.json()[0]["drawn"] is False


# ---- matches/standings gated by draw_published_at, not just the draw existing ----


async def test_matches_hidden_until_draw_is_published_even_if_generated(app, client):
    await _new_org(client)
    tid, slug = await _tournament(client, visibility="public")
    did = await _division(client, tid)
    sid = await _stage(client, did)
    await _open_registration(client, tid)
    await _approved_entrants(client, did, 3)
    draw = await client.post(
        f"/api/v1/stages/{sid}/draw", json={"overrideReadiness": True}, headers=_csrf(client)
    )
    assert draw.status_code == 201, draw.text

    matches = await client.get(f"{PUBLIC}/tournaments/{slug}/matches")
    assert matches.status_code == 200
    assert matches.json() == []  # generated, but not yet published

    standings = await client.get(f"{PUBLIC}/tournaments/{slug}/stages/{sid}/standings")
    assert standings.status_code == 200
    assert standings.json()["rows"] == []


async def test_matches_and_standings_visible_once_draw_published(app, client):
    await _new_org(client)
    tid, slug = await _tournament(client, visibility="public")
    did = await _division(client, tid)
    sid = await _stage(client, did)
    await _open_registration(client, tid)
    await _approved_entrants(client, did, 3)
    await client.post(
        f"/api/v1/stages/{sid}/draw", json={"overrideReadiness": True}, headers=_csrf(client)
    )
    await _publish_draw(client, tid)

    matches = await client.get(f"{PUBLIC}/tournaments/{slug}/matches")
    assert matches.status_code == 200
    assert len(matches.json()) == 3  # C(3,2)
    # MatchView is already PII-free (reused as-is) — no actor/user fields anywhere.
    for match in matches.json():
        assert "actorId" not in match
        for side in match["sides"]:
            assert set(side.keys()) == {
                "participantId",
                "outcome",
                "scoreFor",
                "scoreAgainst",
                "rank",
            }


async def test_public_match_detail_and_events_never_expose_actor(app, client):
    await _new_org(client)
    tid, slug = await _tournament(client, visibility="public")
    did = await _division(client, tid)
    sid = await _stage(client, did)
    await _open_registration(client, tid)
    await _approved_entrants(client, did, 3)
    await client.post(
        f"/api/v1/stages/{sid}/draw", json={"overrideReadiness": True}, headers=_csrf(client)
    )
    await _publish_draw(client, tid)

    matches = (await client.get(f"{PUBLIC}/tournaments/{slug}/matches")).json()
    match = matches[0]
    await _win_payload_and_score(client, match)

    detail = await client.get(f"{PUBLIC}/tournaments/{slug}/matches/{match['id']}")
    assert detail.status_code == 200, detail.text
    assert detail.json()["status"] == "completed"

    events = await client.get(f"{PUBLIC}/tournaments/{slug}/matches/{match['id']}/events")
    assert events.status_code == 200
    assert len(events.json()) == 1
    assert events.json()[0]["actorId"] is None  # the one field this module deliberately omits


async def test_public_participant_detail(app, client):
    await _new_org(client)
    tid, slug = await _tournament(client, visibility="public")
    did = await _division(client, tid)
    await _stage(client, did)
    await _open_registration(client, tid)
    participant_ids = await _approved_entrants(client, did, 2)

    resp = await client.get(f"{PUBLIC}/tournaments/{slug}/participants/{participant_ids[0]}")
    assert resp.status_code == 200, resp.text
    assert resp.json()["id"] == participant_ids[0]


# ---- cross-org / cross-tournament isolation ----


# ---- schedule (court/time) gated by schedule_published_at ----


async def test_court_and_time_hidden_until_schedule_is_published(app, client):
    await _new_org(client)
    tid, slug = await _tournament(client, visibility="public")
    did = await _division(client, tid)
    sid = await _stage(client, did)
    await _open_registration(client, tid)
    await _approved_entrants(client, did, 3)
    await client.post(
        f"/api/v1/stages/{sid}/draw", json={"overrideReadiness": True}, headers=_csrf(client)
    )
    await _publish_draw(client, tid)

    venue = await client.post("/api/v1/venues", json={"name": "Gym"}, headers=_csrf(client))
    court = await client.post(
        "/api/v1/courts",
        json={"venueId": venue.json()["id"], "name": "Court 1"},
        headers=_csrf(client),
    )
    court_id = court.json()["id"]
    await client.post(f"{TOUR}/{tid}/courts", json={"courtId": court_id}, headers=_csrf(client))

    match = (await client.get(f"{PUBLIC}/tournaments/{slug}/matches")).json()[0]
    await client.patch(
        f"/api/v1/matches/{match['id']}/schedule",
        json={"courtId": court_id, "scheduledAt": "2026-07-25T08:00:00Z", "durationMinutes": 30},
        headers=_csrf(client),
    )

    still_hidden = (await client.get(f"{PUBLIC}/tournaments/{slug}/matches")).json()[0]
    assert still_hidden["courtId"] is None
    assert still_hidden["scheduledAt"] is None

    detail_hidden = await client.get(f"{PUBLIC}/tournaments/{slug}/matches/{match['id']}")
    assert detail_hidden.json()["courtId"] is None

    await client.post(
        f"{TOUR}/{tid}/publish", json={"artifacts": ["schedule"]}, headers=_csrf(client)
    )

    now_visible = (await client.get(f"{PUBLIC}/tournaments/{slug}/matches")).json()[0]
    assert now_visible["courtId"] == court_id
    assert now_visible["scheduledAt"] is not None


async def test_match_from_another_tournament_is_not_reachable(app, client):
    await _new_org(client)
    tid_a, slug_a = await _tournament(client, visibility="public")
    did_a = await _division(client, tid_a)
    sid_a = await _stage(client, did_a)
    await _open_registration(client, tid_a)
    await _approved_entrants(client, did_a, 3)
    await client.post(
        f"/api/v1/stages/{sid_a}/draw", json={"overrideReadiness": True}, headers=_csrf(client)
    )
    await _publish_draw(client, tid_a)
    match_a = (await client.get(f"{PUBLIC}/tournaments/{slug_a}/matches")).json()[0]

    _tid_b, slug_b = await _tournament(client, visibility="public")
    resp = await client.get(f"{PUBLIC}/tournaments/{slug_b}/matches/{match_a['id']}")
    assert resp.status_code == 404


async def test_participant_from_another_org_is_not_reachable(app, client):
    await _new_org(client)
    tid_a, _slug_a = await _tournament(client, visibility="public")
    did_a = await _division(client, tid_a)
    await _stage(client, did_a)
    await _open_registration(client, tid_a)
    participant_ids = await _approved_entrants(client, did_a, 1)

    async with _client(app) as other:
        await _new_org(other)
        _tid_b, slug_b = await _tournament(other, visibility="public")
        resp = await other.get(f"{PUBLIC}/tournaments/{slug_b}/participants/{participant_ids[0]}")
        assert resp.status_code == 404
