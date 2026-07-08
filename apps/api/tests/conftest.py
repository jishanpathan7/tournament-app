"""Shared test fixtures: a fresh app, an async HTTP client, and DB session helpers.

DB-backed tests need Postgres (they skip without ``DATABASE_URL``). The target DB is
migrated to head once per session, before any test runs.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator, Iterator
from pathlib import Path

import pytest
import pytest_asyncio
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.main import create_app

API_DIR = Path(__file__).resolve().parents[1]
DATABASE_URL = os.environ.get("DATABASE_URL")


def _alembic_cfg() -> Config:
    cfg = Config(str(API_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(API_DIR / "migrations"))
    return cfg


@pytest.fixture(scope="session", autouse=True)
def _migrate_db() -> Iterator[None]:
    # Ensure the target DB is at head before any DB-backed test (no-op without a DB).
    if DATABASE_URL:
        command.upgrade(_alembic_cfg(), "head")
    yield


@pytest.fixture
def app() -> FastAPI:
    """A fresh app per test (so dependency_overrides don't leak).

    Rate limiting is disabled: all test requests share the same loopback IP and
    would exhaust the per-minute budget (e.g. 5/minute on /register) after just
    a handful of tests, causing 429s that silently skip cookie setup and produce
    cascading 401s on every subsequent authenticated call.
    """
    a = create_app()
    a.state.limiter.enabled = False
    return a


@pytest_asyncio.fixture
async def client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    """An async session whose work is rolled back on close (no commit in tests)."""
    if not DATABASE_URL:
        pytest.skip("DATABASE_URL not set")
    engine = create_async_engine(DATABASE_URL)
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with maker() as session:
        yield session
    await engine.dispose()
