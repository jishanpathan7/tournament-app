"""Row-Level Security: tenants are isolated, globals are visible, FORCE is on.

Connects as a NON-superuser role because superusers (and the table owner, hence
FORCE) bypass RLS. Skips when DATABASE_URL is unset.
"""

import os
import uuid
from pathlib import Path

import asyncpg
import pytest
from alembic import command
from alembic.config import Config

from app.db.rls import GLOBAL_OR_TENANT_TABLES, TENANT_STRICT_TABLES

API_DIR = Path(__file__).resolve().parents[1]
DATABASE_URL = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not set")

TEST_ROLE = "rls_tester"
EXPECTED_FORCED = len(TENANT_STRICT_TABLES) + len(GLOBAL_OR_TENANT_TABLES)


@pytest.fixture(autouse=True)
def _migrated():
    # Sync fixture so the migration's internal asyncio.run() executes OUTSIDE the
    # async test's event loop (alembic's env.py drives the async engine itself).
    cfg = Config(str(API_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(API_DIR / "migrations"))
    command.upgrade(cfg, "head")


def _dsn():
    # asyncpg wants a plain postgresql:// DSN (no SQLAlchemy +asyncpg driver suffix).
    return DATABASE_URL.replace("+asyncpg", "")


async def test_rls_isolates_tenants_and_exposes_globals():
    conn = await asyncpg.connect(_dsn())
    try:
        # Every tenant table must have FORCE (so the owner connection is subject too).
        forced = await conn.fetchval(
            "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
            "WHERE n.nspname = 'public' AND c.relforcerowsecurity"
        )
        assert forced == EXPECTED_FORCED

        # A non-superuser role: superusers bypass RLS entirely.
        await conn.execute(
            f"DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{TEST_ROLE}') "
            f"THEN CREATE ROLE {TEST_ROLE} NOSUPERUSER; END IF; END $$;"
        )
        await conn.execute(f"GRANT USAGE ON SCHEMA public TO {TEST_ROLE}")
        await conn.execute(
            f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {TEST_ROLE}"
        )

        org_a, org_b, sp, ta, tb = (uuid.uuid4() for _ in range(5))

        tx = conn.transaction()
        await tx.start()
        try:
            # Seed as superuser (bypasses RLS): one GLOBAL sport profile, two orgs, two tournaments.
            await conn.execute(
                "INSERT INTO sport_profiles (id, organization_id, key, name, participant_type) "
                "VALUES ($1, NULL, 'badminton', 'Badminton', 'individual')",
                sp,
            )
            for oid, slug in ((org_a, "org-a"), (org_b, "org-b")):
                await conn.execute(
                    "INSERT INTO organizations (id, slug, name) VALUES ($1, $2, $3)",
                    oid,
                    slug,
                    slug,
                )
            for tid, oid, slug in ((ta, org_a, "t-a"), (tb, org_b, "t-b")):
                await conn.execute(
                    "INSERT INTO tournaments (id, organization_id, sport_profile_id, slug, name) "
                    "VALUES ($1, $2, $3, $4, $5)",
                    tid,
                    oid,
                    sp,
                    slug,
                    slug,
                )

            # Switch to the non-superuser role: RLS now applies.
            await conn.execute(f"SET LOCAL ROLE {TEST_ROLE}")

            await conn.execute("SELECT set_config('app.current_org', $1, true)", str(org_a))
            seen = {r["id"] for r in await conn.fetch("SELECT id FROM tournaments")}
            assert seen == {ta}, seen  # org A sees only its own

            await conn.execute("SELECT set_config('app.current_org', $1, true)", str(org_b))
            seen = {r["id"] for r in await conn.fetch("SELECT id FROM tournaments")}
            assert seen == {tb}, seen

            # No org context -> FORCE hides everything (zero rows, not an error).
            await conn.execute("SELECT set_config('app.current_org', '', true)")
            assert await conn.fetchval("SELECT count(*) FROM tournaments") == 0

            # Global sport profile (org_id IS NULL) is visible under any org context.
            await conn.execute("SELECT set_config('app.current_org', $1, true)", str(org_a))
            assert await conn.fetchval("SELECT count(*) FROM sport_profiles WHERE id = $1", sp) == 1
        finally:
            await tx.rollback()  # undo inserts; SET LOCAL ROLE resets with the transaction
    finally:
        await conn.close()
