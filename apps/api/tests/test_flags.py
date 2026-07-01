"""Feature-flag tests: evaluator (precedence + rollout + default) and the org-scoped
management API. DB-backed."""

from __future__ import annotations

import os
import secrets
import uuid

import pytest

from app.core.db import session_scope
from app.db.enums import FeatureFlagScope
from app.modules.flags import service

DATABASE_URL = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not set")

PASSWORD = secrets.token_urlsafe(16)
AUTH = "/api/v1/auth"
ORGS = "/api/v1/orgs"
FLAGS = "/api/v1/feature-flags"


def _key() -> str:
    return f"feat.{uuid.uuid4().hex[:10]}"


async def _upsert(scope, scope_id, key, *, enabled=True, pct=100) -> None:
    async with session_scope() as session:
        async with session.begin():
            await service.upsert(
                session,
                key=key,
                scope=scope,
                scope_id=scope_id,
                enabled=enabled,
                rollout_percentage=pct,
                description=None,
            )


async def _enabled(key, *, org_id=None, user_id=None, default=False) -> bool:
    async with session_scope() as session:
        async with session.begin():
            return await service.is_enabled(
                session, key, org_id=org_id, user_id=user_id, default=default
            )


# ---- evaluator ----


async def test_default_when_no_flag():
    key = _key()
    assert await _enabled(key, user_id=uuid.uuid4(), default=False) is False
    assert await _enabled(key, user_id=uuid.uuid4(), default=True) is True


async def test_global_on_and_off():
    key = _key()
    await _upsert(FeatureFlagScope.GLOBAL, None, key, enabled=True)
    assert await _enabled(key, user_id=uuid.uuid4()) is True
    await _upsert(FeatureFlagScope.GLOBAL, None, key, enabled=False)  # updates same row
    assert await _enabled(key, user_id=uuid.uuid4()) is False


async def test_precedence_user_over_org_over_global():
    key, org, user = _key(), uuid.uuid4(), uuid.uuid4()
    await _upsert(FeatureFlagScope.GLOBAL, None, key, enabled=False)
    assert await _enabled(key, org_id=org, user_id=user) is False
    await _upsert(FeatureFlagScope.ORGANIZATION, org, key, enabled=True)
    assert await _enabled(key, org_id=org, user_id=user) is True  # org beats global
    await _upsert(FeatureFlagScope.USER, user, key, enabled=False)
    assert await _enabled(key, org_id=org, user_id=user) is False  # user beats org


async def test_rollout_percentage_bounds_and_stickiness():
    key, user = _key(), uuid.uuid4()
    await _upsert(FeatureFlagScope.GLOBAL, None, key, enabled=True, pct=0)
    assert await _enabled(key, user_id=user) is False
    await _upsert(FeatureFlagScope.GLOBAL, None, key, enabled=True, pct=100)
    assert await _enabled(key, user_id=user) is True
    await _upsert(FeatureFlagScope.GLOBAL, None, key, enabled=True, pct=50)
    assert await _enabled(key, user_id=user) == await _enabled(key, user_id=user)  # sticky


# ---- management API ----


def _csrf(client) -> dict[str, str]:
    return {"X-CSRF-Token": client.cookies.get("csrf_token") or ""}


async def _auth_owner(client) -> str:
    email = f"u-{uuid.uuid4().hex[:12]}@example.com"
    await client.post(f"{AUTH}/register", json={"email": email, "name": "T", "password": PASSWORD})
    await client.post(f"{AUTH}/login", json={"email": email, "password": PASSWORD})
    org = await client.post(
        ORGS, json={"name": "Acme", "slug": f"org-{uuid.uuid4().hex[:10]}"}, headers=_csrf(client)
    )
    return org.json()["activeOrganizationId"]


async def test_management_api_lifecycle(app, client):
    await _auth_owner(client)
    key = _key()

    created = await client.put(
        FLAGS, json={"key": key, "enabled": True, "rolloutPercentage": 100}, headers=_csrf(client)
    )
    assert created.status_code == 200 and created.json()["scope"] == "organization"
    flag_id = created.json()["id"]

    listing = await client.get(FLAGS)
    assert listing.status_code == 200 and any(f["key"] == key for f in listing.json())

    enabled = await client.get(f"{FLAGS}/{key}/enabled")
    assert enabled.json() == {"key": key, "enabled": True}

    deleted = await client.delete(f"{FLAGS}/{flag_id}", headers=_csrf(client))
    assert deleted.status_code == 204
    assert (await client.get(f"{FLAGS}/{key}/enabled")).json()["enabled"] is False


async def test_upsert_requires_auth(app, client):
    resp = await client.put(FLAGS, json={"key": "x", "enabled": True})
    assert resp.status_code == 401
