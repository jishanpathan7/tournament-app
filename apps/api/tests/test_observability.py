"""Observability tests: metrics + tracing hooks, audit helper, request timing,
readiness. The metric/timing hooks are no-op by default; the request middleware
still records through them (verified with an in-memory recorder)."""

from __future__ import annotations

import os
import secrets
import uuid

import pytest

import app.api.middleware as middleware
from app.core.metrics import InMemoryMetrics, NullMetrics
from app.core.tracing import NullTracer

DATABASE_URL = os.environ.get("DATABASE_URL")

HEALTH = "/api/v1/health"
AUTH = "/api/v1/auth"
ORGS = "/api/v1/orgs"
PASSWORD = secrets.token_urlsafe(16)


async def _create_org(client) -> str:
    email = f"u-{uuid.uuid4().hex[:12]}@example.com"
    await client.post(f"{AUTH}/register", json={"email": email, "name": "T", "password": PASSWORD})
    await client.post(f"{AUTH}/login", json={"email": email, "password": PASSWORD})
    org = await client.post(
        ORGS,
        json={"name": "Acme", "slug": f"org-{uuid.uuid4().hex[:10]}"},
        headers={"X-CSRF-Token": client.cookies.get("csrf_token") or ""},
    )
    return org.json()["activeOrganizationId"]


# ---- unit: hooks (no DB) ----


def test_null_metrics_is_noop():
    m = NullMetrics()
    m.increment("x", 3, status="200")
    m.timing("y", 12.5, method="GET")  # must not raise


def test_in_memory_metrics_records():
    m = InMemoryMetrics()
    m.increment("http_requests_total", status="200")
    m.increment("http_requests_total", status="200")
    m.increment("http_requests_total", status="500")
    m.timing("dur", 10.0)
    m.timing("dur", 20.0)
    assert m.counters["http_requests_total|status=200"] == 2
    assert m.counters["http_requests_total|status=500"] == 1
    assert m.timings["dur"] == [10.0, 20.0]


def test_null_tracer_span_is_context_manager():
    tracer = NullTracer()
    with tracer.span("op", key="v"):
        pass  # no-op, must not raise


# ---- request middleware: timing + metrics ----


async def test_response_carries_request_id_and_timing_headers(app, client):
    resp = await client.get(HEALTH)
    assert resp.status_code == 200
    assert resp.headers.get("x-request-id")
    assert resp.headers.get("x-response-time", "").endswith("ms")


async def test_middleware_records_metrics(app, client, monkeypatch):
    recorder = InMemoryMetrics()
    monkeypatch.setattr(middleware, "get_metrics", lambda: recorder)
    await client.get(HEALTH)
    assert any(k.startswith("http_requests_total") for k in recorder.counters)
    assert any(k.startswith("http_request_duration_ms") for k in recorder.timings)


# ---- readiness + audit (DB-backed) ----

_db = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not set")


@_db
async def test_readiness_reports_database(app, client):
    resp = await client.get(f"{HEALTH}/ready")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok" and body["checks"]["database"] == "ok"


@_db
async def test_audit_helper_writes_row(app, client):
    from sqlalchemy import select

    from app.core import audit
    from app.core.db import session_scope
    from app.db.models import AuditLog
    from app.db.session import set_org_context

    org_id = uuid.UUID(await _create_org(client))  # real org (audit_logs FK)
    entity_id = uuid.uuid4()
    async with session_scope() as session:
        async with session.begin():
            await set_org_context(session, org_id)
            audit.record(
                session,
                organization_id=org_id,
                actor_id=None,
                action="thing.created",
                entity="thing",
                entity_id=entity_id,
                after={"name": "x"},
            )
    async with session_scope() as session:
        async with session.begin():
            await set_org_context(session, org_id)
            row = (
                await session.execute(select(AuditLog).where(AuditLog.entity_id == entity_id))
            ).scalar_one()
    assert row.action == "thing.created" and row.after == {"name": "x"}
