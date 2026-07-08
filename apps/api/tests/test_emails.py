"""Unit tests for email rendering + channels (no DB, no network)."""

from __future__ import annotations

import secrets

import pytest
from jinja2 import UndefinedError

import app.emails.resend_channel as resend_mod
from app.core.config import Settings
from app.emails.log_channel import LogEmailChannel
from app.emails.renderer import known_templates, render
from app.emails.resend_channel import ResendEmailChannel

SETTINGS = Settings()  # defaults: app_name set, frontend_url=http://localhost:3000
FRONT = SETTINGS.frontend_url.rstrip("/")
API_KEY = secrets.token_urlsafe(12)  # generated, no hardcoded secret literal


def test_known_templates_cover_existing_flows():
    assert known_templates() >= {"verify_email", "password_reset", "org_invite"}


def test_render_verify_email():
    r = render("verify_email", {"name": "Ada", "token": "TOK123"}, settings=SETTINGS)
    assert SETTINGS.app_name in r.subject
    assert "Ada" in r.html
    assert f"{FRONT}/verify-email?token=TOK123" in r.html  # button link
    assert "Verify your email address" in r.html
    assert "TOK123" in r.text  # token URL survives into the plaintext part


def test_render_password_reset_and_invite_links():
    reset = render("password_reset", {"name": "A", "token": "T"}, settings=SETTINGS)
    assert f"{FRONT}/reset-password?token=T" in reset.html
    invite = render("org_invite", {"token": "INV", "organizationId": "o1"}, settings=SETTINGS)
    assert f"{FRONT}/invite?token=INV" in invite.html


def test_render_unknown_template_raises():
    with pytest.raises(ValueError):
        render("does_not_exist", {}, settings=SETTINGS)


def test_render_missing_data_is_loud():
    # StrictUndefined: verify_email requires `name` — a mismatch must not render blank.
    with pytest.raises(UndefinedError):
        render("verify_email", {"token": "x"}, settings=SETTINGS)


async def test_resend_channel_sends_rendered_email(monkeypatch):
    captured: dict = {}

    def fake_send(params):
        captured.update(params)
        return {"id": "email_123"}

    monkeypatch.setattr(resend_mod.resend.Emails, "send", fake_send)
    channel = ResendEmailChannel(api_key=API_KEY, sender="No Reply <no@reply>", settings=SETTINGS)
    message_id = await channel.send("u@example.com", "verify_email", {"name": "Ada", "token": "TT"})

    assert message_id == "email_123"
    assert captured["to"] == ["u@example.com"]
    assert captured["from"] == "No Reply <no@reply>"
    assert captured["subject"] and "TT" in captured["html"] and captured["text"]


async def test_log_channel_is_best_effort():
    channel = LogEmailChannel(SETTINGS)
    # An unknown template must not break the calling flow (dev log channel).
    assert await channel.send("u@example.com", "does_not_exist", {"x": 1}) == "logged"
    assert (
        await channel.send("u@example.com", "verify_email", {"name": "A", "token": "T"}) == "logged"
    )
