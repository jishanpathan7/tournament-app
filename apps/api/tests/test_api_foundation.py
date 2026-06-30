"""Exercises the shared API contract (errors, validation, casing, request-id,
pagination, the request-scoped org-context session) — no business endpoints."""

import os
import uuid

import pytest
from fastapi import Depends, FastAPI
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Principal, get_principal, get_request_session
from app.api.errors import NotFoundError
from app.api.pagination import CursorParams, cursor_page
from app.api.schemas import ApiModel
from app.db.enums import OrgRole
from app.db.models import Organization

DATABASE_URL = os.environ.get("DATABASE_URL")
requires_db = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not set")


class _EchoIn(ApiModel):
    count: int


class _CamelOut(ApiModel):
    some_value: int


def _register_routes(app: FastAPI) -> None:
    @app.get("/_t/boom", tags=["t"])
    async def boom() -> _CamelOut:
        raise NotFoundError("nope")

    @app.post("/_t/echo", tags=["t"])
    async def echo(body: _EchoIn) -> _CamelOut:
        return _CamelOut(some_value=body.count)

    @app.get("/_t/camel", tags=["t"])
    async def camel() -> _CamelOut:
        return _CamelOut(some_value=7)


async def test_app_error_renders_problem_details(app, client):
    _register_routes(app)
    resp = await client.get("/_t/boom")
    assert resp.status_code == 404
    assert resp.headers["content-type"].startswith("application/problem+json")
    body = resp.json()
    assert body["title"] == "Not Found"
    assert body["status"] == 404
    assert body["code"] == "not_found"
    assert body["detail"] == "nope"
    assert body["instance"] == "/_t/boom"
    assert body["requestId"]  # correlation id injected by middleware


async def test_validation_errors_are_problem_details_with_field_errors(app, client):
    _register_routes(app)
    resp = await client.post("/_t/echo", json={"count": "not-an-int"})
    assert resp.status_code == 422
    assert resp.headers["content-type"].startswith("application/problem+json")
    body = resp.json()
    assert body["code"] == "validation_error"
    assert any(e["field"] == "count" for e in body["errors"])


async def test_responses_are_camelcase(app, client):
    _register_routes(app)
    resp = await client.get("/_t/camel")
    assert resp.status_code == 200
    assert resp.json() == {"someValue": 7}  # snake_case field -> camelCase wire


async def test_request_id_is_echoed(app, client):
    _register_routes(app)
    supplied = await client.get("/_t/camel", headers={"X-Request-ID": "abc-123"})
    assert supplied.headers["x-request-id"] == "abc-123"
    generated = await client.get("/_t/camel")
    assert generated.headers["x-request-id"]  # auto-generated when absent


async def test_health_still_works(app, client):
    resp = await client.get("/api/v1/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@requires_db
async def test_cursor_pagination_walks_all_pages(db_session: AsyncSession):
    for i in range(5):
        db_session.add(Organization(slug=f"pgn-{i}", name=f"pgn-{i}"))
    await db_session.flush()

    stmt = select(Organization).where(Organization.slug.like("pgn-%"))
    seen: list[uuid.UUID] = []

    rows, cursor = await cursor_page(db_session, stmt, CursorParams(None, 2), entity=Organization)
    assert len(rows) == 2 and cursor is not None
    seen += [r.id for r in rows]

    rows, cursor = await cursor_page(db_session, stmt, CursorParams(cursor, 2), entity=Organization)
    assert len(rows) == 2 and cursor is not None
    seen += [r.id for r in rows]

    rows, cursor = await cursor_page(db_session, stmt, CursorParams(cursor, 2), entity=Organization)
    assert len(rows) == 1 and cursor is None
    seen += [r.id for r in rows]

    assert len(set(seen)) == 5  # all distinct, no overlap across pages
    # session rolls back on close — no committed rows leak.


@requires_db
async def test_request_session_sets_org_context(app, client):
    org_id = uuid.uuid4()

    @app.get("/_t/ctx", tags=["t"])
    async def ctx(session: AsyncSession = Depends(get_request_session)) -> dict[str, str | None]:
        value = await session.scalar(text("SELECT current_setting('app.current_org', true)"))
        return {"org": value}

    app.dependency_overrides[get_principal] = lambda: Principal(
        user_id=uuid.uuid4(), organization_id=org_id, org_role=OrgRole.OWNER
    )
    try:
        resp = await client.get("/_t/ctx")
        assert resp.status_code == 200
        assert resp.json()["org"] == str(org_id)  # set_org_context ran in the request tx
    finally:
        app.dependency_overrides.clear()
