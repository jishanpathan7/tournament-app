"""Auth integration tests: register/login/refresh/logout, sessions, email verify,
password reset/change, brute-force, CSRF, cookies. DB-backed (skips without one)."""

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

# Test-only passwords, generated per run — never hardcode secret-looking literals.
PASSWORD = "Aa1-" + secrets.token_urlsafe(16)
NEW_PASSWORD = "Bb2-" + secrets.token_urlsafe(16)
AUTH = "/api/v1/auth"


def _email() -> str:
    return f"u-{uuid.uuid4().hex[:12]}@example.com"


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


async def _register(client: AsyncClient, email: str, password: str = PASSWORD) -> None:
    resp = await client.post(
        f"{AUTH}/register", json={"email": email, "name": "Test", "password": password}
    )
    assert resp.status_code == 201, resp.text


async def _login(client: AsyncClient, email: str, password: str = PASSWORD, remember: bool = False):
    return await client.post(
        f"{AUTH}/login", json={"email": email, "password": password, "rememberMe": remember}
    )


def _make_client(app: FastAPI) -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def test_register_login_me(app, client):
    email = _email()
    _use_recording_email(app)
    await _register(client, email)
    resp = await _login(client, email)
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == email and body["emailVerified"] is False
    assert body["activeOrganizationId"] is None and body["organizations"] == []
    me = await client.get(f"{AUTH}/me")
    assert me.status_code == 200 and me.json()["email"] == email


async def test_login_sets_expected_cookies(app, client):
    email = _email()
    _use_recording_email(app)
    await _register(client, email)
    resp = await _login(client, email)
    set_cookies = " ".join(resp.headers.get_list("set-cookie")).lower()
    assert "access_token=" in set_cookies and "refresh_token=" in set_cookies
    assert "csrf_token=" in set_cookies
    # access/refresh HttpOnly; csrf readable by JS (not HttpOnly).
    assert set_cookies.count("httponly") == 2
    assert client.cookies.get("csrf_token")  # csrf visible to the client


async def test_invalid_credentials(app, client):
    email = _email()
    _use_recording_email(app)
    await _register(client, email)
    resp = await _login(client, email, password="wrong")
    assert resp.status_code == 401
    assert resp.headers["content-type"].startswith("application/problem+json")


async def test_refresh_rotates_and_detects_reuse(app, client):
    email = _email()
    _use_recording_email(app)
    await _register(client, email)
    await _login(client, email)
    r1 = client.cookies.get("refresh_token")

    rotated = await client.post(f"{AUTH}/refresh")
    assert rotated.status_code == 200
    r2 = client.cookies.get("refresh_token")
    assert r2 and r2 != r1  # rotation issued a new refresh token

    # Replaying the old (rotated-away) token on a fresh client → reuse → 401.
    async with _make_client(app) as attacker:
        replay = await attacker.post(f"{AUTH}/refresh", cookies={"refresh_token": r1})
        assert replay.status_code == 401

    # Reuse burned the whole family: the current token no longer works either.
    assert (await client.post(f"{AUTH}/refresh")).status_code == 401


async def test_logout_revokes_session(app, client):
    email = _email()
    _use_recording_email(app)
    await _register(client, email)
    await _login(client, email)
    out = await client.post(f"{AUTH}/logout", headers=_csrf(client))
    assert out.status_code == 204
    # Session revoked → refresh fails even though the browser may still hold cookies.
    assert (await client.post(f"{AUTH}/refresh")).status_code == 401


async def test_logout_requires_csrf(app, client):
    email = _email()
    _use_recording_email(app)
    await _register(client, email)
    await _login(client, email)
    missing = await client.post(f"{AUTH}/logout")  # no X-CSRF-Token
    assert missing.status_code == 403
    assert missing.json()["code"] == "csrf_failed"


async def test_sessions_list_flags_current(app, client):
    email = _email()
    _use_recording_email(app)
    await _register(client, email)
    await _login(client, email)
    resp = await client.get(f"{AUTH}/sessions")
    assert resp.status_code == 200
    sessions = resp.json()
    assert len(sessions) >= 1 and any(s["current"] for s in sessions)


async def test_email_verification_flow(app, client):
    email = _email()
    recorder = _use_recording_email(app)
    await _register(client, email)
    token = recorder.sent[-1]["data"]["token"]  # captured verification token
    confirm = await client.post(f"{AUTH}/verify-email/confirm", json={"token": token})
    assert confirm.status_code == 204
    # Single-use: a second confirm fails.
    assert (
        await client.post(f"{AUTH}/verify-email/confirm", json={"token": token})
    ).status_code == 422
    await _login(client, email)
    assert (await client.get(f"{AUTH}/me")).json()["emailVerified"] is True


async def test_password_reset_flow(app, client):
    email = _email()
    recorder = _use_recording_email(app)
    await _register(client, email)
    # Unknown email still returns 202 (no account enumeration).
    unknown = await client.post(f"{AUTH}/password-reset/request", json={"email": _email()})
    assert unknown.status_code == 202
    assert (
        await client.post(f"{AUTH}/password-reset/request", json={"email": email})
    ).status_code == 202
    token = recorder.sent[-1]["data"]["token"]
    new_password = NEW_PASSWORD
    confirm = await client.post(
        f"{AUTH}/password-reset/confirm", json={"token": token, "newPassword": new_password}
    )
    assert confirm.status_code == 204
    assert (await _login(client, email, password=PASSWORD)).status_code == 401  # old pw dead
    assert (await _login(client, email, password=new_password)).status_code == 200


async def test_change_password(app, client):
    email = _email()
    _use_recording_email(app)
    await _register(client, email)
    await _login(client, email)
    new_password = NEW_PASSWORD
    resp = await client.post(
        f"{AUTH}/password/change",
        json={"currentPassword": PASSWORD, "newPassword": new_password},
        headers=_csrf(client),
    )
    assert resp.status_code == 204
    async with _make_client(app) as fresh:
        assert (await _login(fresh, email, password=new_password)).status_code == 200
        assert (await _login(fresh, email, password=PASSWORD)).status_code == 401


async def test_brute_force_lockout(app, client):
    email = _email()
    _use_recording_email(app)
    await _register(client, email)
    statuses = [(await _login(client, email, password="wrong")).status_code for _ in range(11)]
    assert 401 in statuses and statuses[-1] == 429  # locked out after repeated failures


async def test_me_requires_auth(app, client):
    resp = await client.get(f"{AUTH}/me")
    assert resp.status_code == 401
    assert resp.json()["code"] == "unauthorized"


async def test_authed_mutation_unauthenticated_is_401_not_csrf(app, client):
    # Auth is resolved before CSRF, so an unauthenticated mutation is a truthful 401.
    resp = await client.post(
        f"{AUTH}/password/change", json={"currentPassword": "wrong", "newPassword": NEW_PASSWORD}
    )
    assert resp.status_code == 401 and resp.json()["code"] == "unauthorized"
