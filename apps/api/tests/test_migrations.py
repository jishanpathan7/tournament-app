"""Alembic round-trip: upgrade -> downgrade -> upgrade leaves a clean, complete schema.

Runs against a scratch database this test creates and drops itself, never the one
``DATABASE_URL`` points at. Downgrading to base drops every table, so pointing it
at a working database destroys it; and a downgrade can legitimately fail on real
data (0014 swaps the tournaments slug constraint for a partial index, so once a
soft-deleted row reuses a slug the plain constraint can no longer be restored).
Both problems disappear once the test owns its database.

Skips gracefully when DATABASE_URL is unset (keeps the default `pytest` green
without Postgres).
"""

import asyncio
import os
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

import app.db.models  # noqa: F401  -- registers all tables on Base.metadata
from app.db.base import Base
from app.db.enums import ALL_PG_ENUMS

API_DIR = Path(__file__).resolve().parents[1]
DATABASE_URL = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not set")

EXPECTED_TABLES = len(Base.metadata.tables)
# +8 post-baseline enums: auth_token_purpose (0002), feature_flag_scope (0006),
# court_status (0010), pairing_run_status (0011), attendance_status (0012),
# contest_kind (0016), tournament_role + tournament_invite_status (0020).
EXPECTED_ENUMS = len(ALL_PG_ENUMS) + 8


def _cfg() -> Config:
    cfg = Config(str(API_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(API_DIR / "migrations"))
    return cfg


def _with_database(url: str, name: str) -> str:
    """Same server and credentials, different database name."""
    return urlunparse(urlparse(url)._replace(path=f"/{name}"))


async def _run_on_maintenance_db(url: str, statement: str) -> None:
    """CREATE/DROP DATABASE cannot run in a transaction — use autocommit."""
    engine = create_async_engine(_with_database(url, "postgres"), isolation_level="AUTOCOMMIT")
    try:
        async with engine.connect() as conn:
            await conn.execute(text(statement))
    finally:
        await engine.dispose()


async def _counts(url: str) -> tuple[int, int]:
    engine = create_async_engine(url)
    try:
        async with engine.connect() as conn:
            tables = await conn.scalar(
                text(
                    "select count(*) from information_schema.tables "
                    "where table_schema='public' and table_type='BASE TABLE' "
                    "and table_name <> 'alembic_version'"
                )
            )
            enums = await conn.scalar(text("select count(*) from pg_type where typtype='e'"))
        return tables, enums
    finally:
        await engine.dispose()


@contextmanager
def _scratch_database() -> Iterator[str]:
    """Create an empty database, yield its URL, then drop it."""
    assert DATABASE_URL
    name = f"playlane_migrations_{uuid.uuid4().hex[:12]}"
    url = _with_database(DATABASE_URL, name)

    asyncio.run(_run_on_maintenance_db(DATABASE_URL, f'CREATE DATABASE "{name}"'))
    # Alembic reads DIRECT_URL ahead of DATABASE_URL (see migrations/env.py), so
    # this points the migration run at the scratch database without disturbing
    # the app settings every other test relies on.
    previous = os.environ.get("DIRECT_URL")
    os.environ["DIRECT_URL"] = url
    try:
        yield url
    finally:
        if previous is None:
            os.environ.pop("DIRECT_URL", None)
        else:
            os.environ["DIRECT_URL"] = previous
        asyncio.run(
            _run_on_maintenance_db(DATABASE_URL, f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
        )


def test_upgrade_downgrade_roundtrip():
    with _scratch_database() as url:
        cfg = _cfg()

        command.upgrade(cfg, "head")
        assert asyncio.run(_counts(url)) == (EXPECTED_TABLES, EXPECTED_ENUMS)

        # Downgrade must leave NO orphaned tables AND no orphaned enum types.
        command.downgrade(cfg, "base")
        assert asyncio.run(_counts(url)) == (0, 0)

        command.upgrade(cfg, "head")
        assert asyncio.run(_counts(url)) == (EXPECTED_TABLES, EXPECTED_ENUMS)
