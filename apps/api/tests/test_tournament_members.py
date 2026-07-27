"""Tournament staff (collaborative access): invite flows must leave the invitee
able to actually SEE the tournament — which means an org membership, not just a
tournament_members row. DB-backed (skips without a database)."""

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


class RecordingEmail:
    def __init__(self) -> None:
        self.sent: list[dict] = []

    async def send(self, to: str, template: str, data: dict) -> str:
        self.sent.append({"to": to, "template": template, "data": data})
        return "recorded"


def _use_recording_email(app: FastAPI) -> RecordingEmail:
    recorder = RecordingEmail()
    app.dependency_overrides[get_email_channel] = lambda: recorder
    return recorder


def _make_client(app: FastAPI) -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _register_login(client: AsyncClient, email: str) -> None:
    await client.post(f"{AUTH}/register", json={"email": email, "name": "T", "password": PASSWORD})
    resp = await client.post(f"{AUTH}/login", json={"email": email, "password": PASSWORD})
    assert resp.status_code == 200, resp.text


async def _create_org(client: AsyncClient) -> str:
    resp = await client.post(ORGS, json={"name": "Acme", "slug": _slug()}, headers=_csrf(client))
    assert resp.status_code == 201, resp.text
    return resp.json()["activeOrganizationId"]


async def _create_tournament(client: AsyncClient) -> str:
    resp = await client.post(
        TOUR,
        json={"name": "SIBL", "slug": _slug(), "sportKey": "badminton", "visibility": "private"},
        headers=_csrf(client),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def test_inviting_existing_user_grants_org_membership_so_they_see_the_tournament(app, client):
    """Regression: an existing platform user invited by email was added as a
    tournament member but got no org membership, so the org-scoped tournament list
    never surfaced the tournament — and they couldn't even switch to the org."""
    _use_recording_email(app)

    # User B already has an account but belongs to no org yet.
    client_b = _make_client(app)
    b_email = _email()
    await _register_login(client_b, b_email)
    me_before = await client_b.get(f"{AUTH}/me")
    assert me_before.json()["organizations"] == []

    # User A owns an org + a (private) tournament.
    await _register_login(client, _email())
    org_id = await _create_org(client)
    tid = await _create_tournament(client)

    # A invites existing user B onto the tournament.
    inv = await client.post(
        f"{TOUR}/{tid}/members/invite",
        json={"email": b_email, "tournamentRole": "organizer"},
        headers=_csrf(client),
    )
    assert inv.status_code == 201, inv.text
    assert inv.json()["status"] == "accepted"  # existing user is added directly

    # B now belongs to A's org …
    me_after = await client_b.get(f"{AUTH}/me")
    org_ids = [o["id"] for o in me_after.json()["organizations"]]
    assert org_id in org_ids, "invited existing user must gain an org membership"

    # … can switch to it and actually see the tournament.
    sw = await client_b.post(
        f"{ORGS}/switch", json={"organizationId": org_id}, headers=_csrf(client_b)
    )
    assert sw.status_code == 200, sw.text
    listing = await client_b.get(TOUR)
    assert listing.status_code == 200, listing.text
    assert any(t["id"] == tid for t in listing.json())


async def test_accept_pending_invite_grants_org_membership_and_switches_active_org(app, client):
    """External invitee → pending invite → accept must leave them an org member with
    the invited org active, so the tournament is immediately visible."""
    recorder = _use_recording_email(app)

    await _register_login(client, _email())
    org_id = await _create_org(client)
    tid = await _create_tournament(client)

    # Invite an email with no existing account → a pending invite + emailed token.
    invitee_email = _email()
    inv = await client.post(
        f"{TOUR}/{tid}/members/invite",
        json={"email": invitee_email, "tournamentRole": "organizer"},
        headers=_csrf(client),
    )
    assert inv.status_code == 201, inv.text
    assert inv.json()["status"] == "pending"
    token = next(e["data"]["token"] for e in recorder.sent if e["template"] == "tournament_invite")

    # The invitee registers, then accepts.
    client_b = _make_client(app)
    await _register_login(client_b, invitee_email)
    acc = await client_b.post(
        "/api/v1/tournament-invites/accept",
        json={"token": token},
        headers=_csrf(client_b),
    )
    assert acc.status_code == 200, acc.text
    assert acc.json()["organization_id"] == org_id

    # Accept re-minted the cookie with the invited org active → tournament visible now.
    me = await client_b.get(f"{AUTH}/me")
    assert me.json()["activeOrganizationId"] == org_id
    listing = await client_b.get(TOUR)
    assert any(t["id"] == tid for t in listing.json())


async def test_copy_invite_link_token_can_be_accepted(app, client):
    """The Copy-Invite-Link token (email-less invite) must resolve through the same
    accept flow and grant access."""
    _use_recording_email(app)

    await _register_login(client, _email())
    org_id = await _create_org(client)
    tid = await _create_tournament(client)

    link = await client.post(
        f"{TOUR}/{tid}/members/invite-link",
        json={"tournamentRole": "scorekeeper"},
        headers=_csrf(client),
    )
    assert link.status_code == 201, link.text
    token = link.json()["token"]
    assert token

    client_b = _make_client(app)
    await _register_login(client_b, _email())
    acc = await client_b.post(
        "/api/v1/tournament-invites/accept",
        json={"token": token},
        headers=_csrf(client_b),
    )
    assert acc.status_code == 200, acc.text
    assert acc.json()["tournament_id"] == tid
    me = await client_b.get(f"{AUTH}/me")
    assert me.json()["activeOrganizationId"] == org_id
