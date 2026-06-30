"""Shared test fixtures: a fresh app, an async HTTP client, and DB session helpers.

DB-backed fixtures skip when DATABASE_URL is unset (keeps the default suite green
without Postgres). The migration is applied once per session.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
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


@pytest.fixture
def app() -> FastAPI:
    """A fresh app per test (so dependency_overrides don't leak)."""
    return create_app()


@pytest_asyncio.fixture
async def client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client


@pytest.fixture(scope="session")
def _migrated() -> None:
    if not DATABASE_URL:
        pytest.skip("DATABASE_URL not set")
    cfg = Config(str(API_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(API_DIR / "migrations"))
    command.upgrade(cfg, "head")


@pytest_asyncio.fixture
async def db_session(_migrated: None) -> AsyncIterator[AsyncSession]:
    """An async session whose work is rolled back on close (no commit in tests)."""
    engine = create_async_engine(DATABASE_URL or "")
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with maker() as session:
        yield session
    await engine.dispose()
