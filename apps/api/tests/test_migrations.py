"""Alembic round-trip: upgrade -> downgrade -> upgrade leaves a clean, complete schema.

Skips gracefully when DATABASE_URL is unset (keeps the default `pytest` green
without Postgres). Drive against a disposable database in CI.
"""

import asyncio
import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

import app.db.models  # noqa: F401  -- registers all tables on Base.metadata
from app.core.db import reset_engine
from app.db.base import Base
from app.db.enums import ALL_PG_ENUMS

API_DIR = Path(__file__).resolve().parents[1]
DATABASE_URL = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not set")

EXPECTED_TABLES = len(Base.metadata.tables)
# +4 post-baseline enums: auth_token_purpose (0002), feature_flag_scope (0006),
# court_status (0010), pairing_run_status (0011).
EXPECTED_ENUMS = len(ALL_PG_ENUMS) + 4


def _cfg():
    cfg = Config(str(API_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(API_DIR / "migrations"))
    return cfg


async def _counts():
    engine = create_async_engine(DATABASE_URL)
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


def test_upgrade_downgrade_roundtrip():
    cfg = _cfg()
    try:
        command.upgrade(cfg, "head")
        assert asyncio.run(_counts()) == (EXPECTED_TABLES, EXPECTED_ENUMS)

        # Downgrade must leave NO orphaned tables AND no orphaned enum types.
        command.downgrade(cfg, "base")
        assert asyncio.run(_counts()) == (0, 0)

        command.upgrade(cfg, "head")  # restore for any later DB-backed tests
        assert asyncio.run(_counts()) == (EXPECTED_TABLES, EXPECTED_ENUMS)
    finally:
        # Recreated enum types got new OIDs → refresh the app engine's pooled
        # connections (their asyncpg type cache is now stale) for later tests.
        reset_engine()
