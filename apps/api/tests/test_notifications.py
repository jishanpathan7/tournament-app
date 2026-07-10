"""Notification framework tests: in-app inbox (list / unread-count / read / read-all)
and async email dispatch through the job worker. DB-backed."""

from __future__ import annotations

import os
import secrets
import uuid

import pytest
from sqlalchemy import text

import app.modules.notifications.channels as channels_mod
from app.core.db import session_scope
from app.db.enums import NotificationChannel
from app.db.models import Notification
from app.db.session import set_org_context
from app.modules.notifications import service
from app.modules.notifications.templates import NotificationTemplate, register_template
from app.workers import poller

DATABASE_URL = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not set")

PASSWORD = secrets.token_urlsafe(16)
AUTH = "/api/v1/auth"
ORGS = "/api/v1/orgs"
NOTIF = "/api/v1/notifications"


def _email() -> str:
    return f"u-{uuid.uuid4().hex[:12]}@example.com"


def _slug() -> str:
    return f"org-{uuid.uuid4().hex[:10]}"


def _csrf(client) -> dict[str, str]:
    return {"X-CSRF-Token": client.cookies.get("csrf_token") or ""}


async def _auth_and_org(client) -> tuple[str, str, str]:
    email = _email()
    await client.post(f"{AUTH}/register", json={"email": email, "name": "T", "password": PASSWORD})
    login = await client.post(f"{AUTH}/login", json={"email": email, "password": PASSWORD})
    user_id = login.json()["id"]
    org = await client.post(ORGS, json={"name": "Acme", "slug": _slug()}, headers=_csrf(client))
    return user_id, org.json()["activeOrganizationId"], email


async def _seed(org_id, user_id, *, type_, data, channels=None, n=1) -> list[str]:
    ids: list[str] = []
    async with session_scope() as session:
        async with session.begin():
            await set_org_context(session, org_id)
            for _ in range(n):
                created = await service.notify(
                    session,
                    organization_id=uuid.UUID(org_id),
                    recipient_user_id=uuid.UUID(user_id),
                    type=type_,
                    data=data,
                    channels=channels,
                )
                ids += [str(c.id) for c in created]
    return ids


async def _notification(org_id, notification_id) -> Notification | None:
    async with session_scope() as session:
        async with session.begin():
            await set_org_context(session, org_id)
            return await session.get(Notification, uuid.UUID(notification_id))


async def _clear_outbox() -> None:
    async with session_scope() as session:
        async with session.begin():
            await session.execute(text("DELETE FROM outbox"))


async def test_inbox_list_and_unread_count(app, client):
    user_id, org_id, _ = await _auth_and_org(client)
    await _seed(
        org_id, user_id, type_="system.announcement", data={"title": "Hi", "body": "B"}, n=3
    )

    listing = await client.get(NOTIF)
    assert listing.status_code == 200
    body = listing.json()
    assert len(body["items"]) == 3 and body["items"][0]["title"] == "Hi"

    # unread-count only counts action_required priority; system.announcement is
    # IMPORTANT, so the badge count is 0 even though items exist in the feed.
    count = await client.get(f"{NOTIF}/unread-count")
    assert count.status_code == 200 and count.json()["count"] == 0

    # Seed an action_required notification and confirm it increments the badge.
    await _seed(
        org_id,
        user_id,
        type_="ops.draw_failed",
        data={"error_summary": "test", "tournament_id": str(org_id)},
        n=1,
    )
    count2 = await client.get(f"{NOTIF}/unread-count")
    assert count2.json()["count"] == 1


async def test_mark_read_and_read_all(app, client):
    user_id, org_id, _ = await _auth_and_org(client)
    ids = await _seed(
        org_id, user_id, type_="system.announcement", data={"title": "H", "body": "B"}, n=3
    )

    read = await client.post(f"{NOTIF}/{ids[0]}/read", headers=_csrf(client))
    assert read.status_code == 200 and read.json()["status"] == "read"
    # system.announcement is IMPORTANT — unread-count tracks action_required only, stays 0.
    assert (await client.get(f"{NOTIF}/unread-count")).json()["count"] == 0

    all_read = await client.post(f"{NOTIF}/read-all", headers=_csrf(client))
    assert all_read.status_code == 200 and all_read.json()["updated"] == 2
    assert (await client.get(f"{NOTIF}/unread-count")).json()["count"] == 0


async def test_list_unread_only(app, client):
    user_id, org_id, _ = await _auth_and_org(client)
    ids = await _seed(
        org_id, user_id, type_="system.announcement", data={"title": "H", "body": "B"}, n=3
    )
    await client.post(f"{NOTIF}/{ids[0]}/read", headers=_csrf(client))

    unread = await client.get(f"{NOTIF}?unreadOnly=true")
    assert unread.status_code == 200 and len(unread.json()["items"]) == 2


async def test_notifications_require_auth(app, client):
    assert (await client.get(NOTIF)).status_code == 401


async def test_email_notification_dispatched_via_worker(app, client, monkeypatch):
    user_id, org_id, email = await _auth_and_org(client)
    register_template(
        NotificationTemplate(
            type="test.invited",
            channels=(NotificationChannel.EMAIL,),
            in_app_title="",
            in_app_body="",
            email_template="org_invite",
        )
    )
    sent: list[tuple] = []

    class Recorder:
        async def send(self, to: str, template: str, data: dict) -> str:
            sent.append((to, template, data))
            return "recorded"

    monkeypatch.setattr(channels_mod, "get_email_channel", lambda: Recorder())

    await _clear_outbox()
    ids = await _seed(
        org_id,
        user_id,
        type_="test.invited",
        data={"token": "TK"},
        channels=[NotificationChannel.EMAIL],
    )
    # Notification starts pending; the worker delivers it.
    assert (await _notification(org_id, ids[0])).status == "pending"

    await poller.process_pending(batch_size=50, max_attempts=3)

    assert sent == [(email, "org_invite", {"token": "TK"})]
    delivered = await _notification(org_id, ids[0])
    assert delivered is not None and delivered.status == "sent" and delivered.sent_at is not None
