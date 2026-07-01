"""Orgs integration tests: create, switch, invitations, membership roles,
permission checks, last-owner guard, org scoping. DB-backed (skips without one)."""

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

# Test-only password, generated per run — never hardcode secret-looking literals.
PASSWORD = "Aa1-" + secrets.token_urlsafe(16)
AUTH = "/api/v1/auth"
ORGS = "/api/v1/orgs"


def _email() -> str:
    return f"u-{uuid.uuid4().hex[:12]}@example.com"


def _slug() -> str:
    return f"org-{uuid.uuid4().hex[:10]}"


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


async def _register_login(client: AsyncClient, email: str) -> dict:
    await client.post(f"{AUTH}/register", json={"email": email, "name": "T", "password": PASSWORD})
    resp = await client.post(f"{AUTH}/login", json={"email": email, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _create_org(client: AsyncClient) -> dict:
    resp = await client.post(ORGS, json={"name": "Acme", "slug": _slug()}, headers=_csrf(client))
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_create_org_makes_owner(app, client):
    _use_recording_email(app)
    await _register_login(client, _email())
    body = await _create_org(client)
    assert body["activeRole"] == "owner"
    assert len(body["organizations"]) == 1
    me = await client.get(f"{AUTH}/me")
    assert me.json()["activeOrganizationId"] == body["activeOrganizationId"]


async def test_switch_org_and_non_member_denied(app, client):
    _use_recording_email(app)
    await _register_login(client, _email())
    a = await _create_org(client)
    org_a = a["activeOrganizationId"]
    b = await _create_org(client)  # creating B makes B active
    assert b["activeOrganizationId"] != org_a

    switched = await client.post(
        f"{ORGS}/switch", json={"organizationId": org_a}, headers=_csrf(client)
    )
    assert switched.status_code == 200 and switched.json()["activeOrganizationId"] == org_a

    async with _make_client(app) as other:
        await _register_login(other, _email())
        outsider_org = (await _create_org(other))["activeOrganizationId"]
    denied = await client.post(
        f"{ORGS}/switch", json={"organizationId": outsider_org}, headers=_csrf(client)
    )
    assert denied.status_code == 403


async def test_invite_accept_members_and_permissions(app, client):
    recorder = _use_recording_email(app)
    await _register_login(client, _email())  # owner
    await _create_org(client)

    invitee = _email()
    invite = await client.post(
        f"{ORGS}/active/invites", json={"email": invitee, "role": "viewer"}, headers=_csrf(client)
    )
    assert invite.status_code == 201
    token = recorder.sent[-1]["data"]["token"]

    async with _make_client(app) as viewer:
        await _register_login(viewer, invitee)
        accepted = await viewer.post(
            f"{ORGS}/invites/accept", json={"token": token}, headers=_csrf(viewer)
        )
        assert accepted.status_code == 200 and accepted.json()["activeRole"] == "viewer"

        # Viewer lacks org:update → 403 (policy enforced via require_permission).
        forbidden = await viewer.patch(
            f"{ORGS}/active", json={"name": "Renamed"}, headers=_csrf(viewer)
        )
        assert forbidden.status_code == 403

    # Owner sees both members; the accepted invite is no longer pending.
    members = await client.get(f"{ORGS}/active/members")
    assert members.status_code == 200 and len(members.json()) == 2
    assert (await client.get(f"{ORGS}/active/invites")).json() == []

    # Owner can update the org.
    ok = await client.patch(f"{ORGS}/active", json={"name": "Renamed"}, headers=_csrf(client))
    assert ok.status_code == 200 and ok.json()["name"] == "Renamed"


async def test_last_owner_cannot_be_demoted(app, client):
    _use_recording_email(app)
    me = await _register_login(client, _email())
    await _create_org(client)
    resp = await client.patch(
        f"{ORGS}/active/members/{me['id']}", json={"role": "viewer"}, headers=_csrf(client)
    )
    assert resp.status_code == 409  # last owner guard


async def test_member_role_change_and_removal(app, client):
    recorder = _use_recording_email(app)
    await _register_login(client, _email())  # owner
    await _create_org(client)
    invitee = _email()
    await client.post(
        f"{ORGS}/active/invites", json={"email": invitee, "role": "admin"}, headers=_csrf(client)
    )
    token = recorder.sent[-1]["data"]["token"]
    async with _make_client(app) as member:
        member_me = await _register_login(member, invitee)
        await member.post(f"{ORGS}/invites/accept", json={"token": token}, headers=_csrf(member))
    member_id = member_me["id"]

    demote = await client.patch(
        f"{ORGS}/active/members/{member_id}", json={"role": "viewer"}, headers=_csrf(client)
    )
    assert demote.status_code == 200 and demote.json()["role"] == "viewer"
    removed = await client.delete(f"{ORGS}/active/members/{member_id}", headers=_csrf(client))
    assert removed.status_code == 204
    assert len((await client.get(f"{ORGS}/active/members")).json()) == 1


async def test_create_org_unauthenticated_is_401(app, client):
    resp = await client.post(ORGS, json={"name": "X", "slug": "x-unauth"})
    assert resp.status_code == 401 and resp.json()["code"] == "unauthorized"


async def test_org_scoping_isolates_members(app, client):
    _use_recording_email(app)
    await _register_login(client, _email())
    await _create_org(client)
    async with _make_client(app) as other:
        await _register_login(other, _email())
        await _create_org(other)
        # Each caller only sees their own active org's members (app-scoped by org id).
        assert len((await other.get(f"{ORGS}/active/members")).json()) == 1
    assert len((await client.get(f"{ORGS}/active/members")).json()) == 1
