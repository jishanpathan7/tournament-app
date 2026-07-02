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
            # Scoped to just these two seeded rows: this DB accumulates other tests'
            # (committed) tournaments across runs, and — since ta/tb default to
            # 'private' — those don't interfere here. An unrestricted `SELECT` would,
            # now that `tournaments_public_read` also permits any 'public'/'unlisted'
            # row regardless of org context (see that policy's own dedicated test
            # below); this test is only about the org-isolation policy.
            both = [ta, tb]

            await conn.execute("SELECT set_config('app.current_org', $1, true)", str(org_a))
            seen = {
                r["id"]
                for r in await conn.fetch("SELECT id FROM tournaments WHERE id = ANY($1)", both)
            }
            assert seen == {ta}, seen  # org A sees only its own

            await conn.execute("SELECT set_config('app.current_org', $1, true)", str(org_b))
            seen = {
                r["id"]
                for r in await conn.fetch("SELECT id FROM tournaments WHERE id = ANY($1)", both)
            }
            assert seen == {tb}, seen

            # No org context -> FORCE hides everything private (zero rows, not an error).
            await conn.execute("SELECT set_config('app.current_org', '', true)")
            assert (
                await conn.fetchval("SELECT count(*) FROM tournaments WHERE id = ANY($1)", both)
                == 0
            )

            # Global sport profile (org_id IS NULL) is visible under any org context.
            await conn.execute("SELECT set_config('app.current_org', $1, true)", str(org_a))
            assert await conn.fetchval("SELECT count(*) FROM sport_profiles WHERE id = $1", sp) == 1
        finally:
            await tx.rollback()  # undo inserts; SET LOCAL ROLE resets with the transaction
    finally:
        await conn.close()


async def test_public_read_policy_exposes_only_public_and_unlisted():
    """The additive `tournaments_public_read` policy (see `app.db.rls`): with NO org
    context at all, a non-superuser connection sees 'public'/'unlisted' tournaments
    across every org, but never 'private' ones — this is what lets the public
    microsite resolve a tournament by slug before it has any org context."""
    conn = await asyncpg.connect(_dsn())
    try:
        await conn.execute(
            f"DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{TEST_ROLE}') "
            f"THEN CREATE ROLE {TEST_ROLE} NOSUPERUSER; END IF; END $$;"
        )
        await conn.execute(f"GRANT USAGE ON SCHEMA public TO {TEST_ROLE}")
        await conn.execute(
            f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {TEST_ROLE}"
        )

        org, sp, t_public, t_unlisted, t_private = (uuid.uuid4() for _ in range(5))

        tx = conn.transaction()
        await tx.start()
        try:
            await conn.execute(
                "INSERT INTO sport_profiles (id, organization_id, key, name, participant_type) "
                "VALUES ($1, NULL, 'badminton', 'Badminton', 'individual')",
                sp,
            )
            await conn.execute(
                "INSERT INTO organizations (id, slug, name) VALUES ($1, $2, $3)",
                org,
                "org-c",
                "org-c",
            )
            for tid, slug, visibility in (
                (t_public, "t-public", "public"),
                (t_unlisted, "t-unlisted", "unlisted"),
                (t_private, "t-private", "private"),
            ):
                await conn.execute(
                    "INSERT INTO tournaments "
                    "(id, organization_id, sport_profile_id, slug, name, visibility) "
                    "VALUES ($1, $2, $3, $4, $5, $6)",
                    tid,
                    org,
                    sp,
                    slug,
                    slug,
                    visibility,
                )

            await conn.execute(f"SET LOCAL ROLE {TEST_ROLE}")
            await conn.execute("SELECT set_config('app.current_org', '', true)")

            # This DB accumulates other tests' committed public/unlisted tournaments
            # across runs, so scope the visibility check to just these three seeded
            # rows rather than asserting an exact, exhaustive result set.
            seeded = [t_public, t_unlisted, t_private]
            seen = {
                r["id"]
                for r in await conn.fetch("SELECT id FROM tournaments WHERE id = ANY($1)", seeded)
            }
            assert seen == {t_public, t_unlisted}, seen
        finally:
            await tx.rollback()
    finally:
        await conn.close()
