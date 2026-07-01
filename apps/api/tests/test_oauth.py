"""Google OAuth tests with a MOCKED provider (no network). DB-backed for the callback."""

from __future__ import annotations

import os
import uuid

import pytest

import app.core.oauth as oauth_mod
from app.core.oauth import OAuthUserInfo

DATABASE_URL = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not set")

AUTH = "/api/v1/auth"


class _FakeGoogle:
    name = "google"

    def __init__(self, email: str, subject: str) -> None:
        self._email = email
        self._subject = subject

    def authorize_url(self, state: str) -> str:
        return f"https://accounts.google.com/o/oauth2/v2/auth?state={state}"

    async def exchange(self, code: str) -> OAuthUserInfo:
        return OAuthUserInfo(
            provider="google",
            subject=self._subject,
            email=self._email,
            name="OAuth User",
            email_verified=True,
        )


def _patch_provider(monkeypatch, email: str, subject: str) -> None:
    monkeypatch.setattr(
        oauth_mod, "get_google_provider", lambda settings=None: _FakeGoogle(email, subject)
    )


async def test_google_authorize_redirects_when_configured(app, client, monkeypatch):
    _patch_provider(monkeypatch, "x@example.com", "sub-x")
    resp = await client.get(f"{AUTH}/google/authorize", follow_redirects=False)
    assert resp.status_code == 302
    assert "accounts.google.com" in resp.headers["location"]
    assert client.cookies.get("oauth_state")  # state stashed for the callback


async def test_google_callback_provisions_user_and_logs_in(app, client, monkeypatch):
    email = f"oauth-{uuid.uuid4().hex[:10]}@example.com"
    _patch_provider(monkeypatch, email, f"sub-{uuid.uuid4().hex[:10]}")
    # Real handshake: authorize sets the oauth_state cookie; echo it back on callback.
    await client.get(f"{AUTH}/google/authorize", follow_redirects=False)
    state = client.cookies.get("oauth_state")
    resp = await client.get(
        f"{AUTH}/google/callback?code=xyz&state={state}", follow_redirects=False
    )
    assert resp.status_code == 303  # redirects to the frontend, cookies set
    me = await client.get(f"{AUTH}/me")
    assert me.status_code == 200
    body = me.json()
    assert body["email"] == email and body["emailVerified"] is True


async def test_google_callback_rejects_bad_state(app, client, monkeypatch):
    _patch_provider(monkeypatch, "y@example.com", "sub-y")
    await client.get(f"{AUTH}/google/authorize", follow_redirects=False)  # sets a real state cookie
    resp = await client.get(
        f"{AUTH}/google/callback?code=xyz&state=WRONG-STATE", follow_redirects=False
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "oauth_state"
