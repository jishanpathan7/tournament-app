"""initial schema — full core data layer + Row-Level Security

Baseline migration. It builds the entire schema from the ORM metadata
(``app.db.models``) rather than transcribing 33 tables by hand:

  1. create all native ENUM types — the columns use ``create_type=False``, so the
     types are created here explicitly and exactly once (a type shared by several
     tables is not emitted more than once);
  2. ``Base.metadata.create_all`` — tables, FKs, indexes (incl. the partial and
     functional ones), unique & check constraints, all with deterministic names
     from the metadata naming convention;
  3. enable + FORCE Row-Level Security and create the per-table org-isolation
     policies (see ``app.db.rls``).

Subsequent schema changes are ordinary per-change migrations (Alembic autogenerate
diffs cleanly against the naming convention). RLS policies are hand-managed here —
autogenerate does not track them.

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-30
"""

from __future__ import annotations

from alembic import op

import app.db.models  # noqa: F401  # registers every table on Base.metadata
from app.db import rls, triggers
from app.db.base import Base
from app.db.enums import ALL_PG_ENUMS, CONTEST_KIND

MIN_PG_VERSION_NUM = 150000  # standings UNIQUE ... NULLS NOT DISTINCT requires PG 15+

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


# The 35 tables this baseline owns. Pinned explicitly: Base.metadata is shared/live,
# so create_all() must be restricted to these or it would also build tables added by
# LATER migrations.
# squads/squad_members are included here (not in 0014) because participants.squad_id
# has a FK → squads.id, so squads must exist before participants is created on a
# fresh database. Migration 0014 uses checkfirst=True / if_not_exists, so it is safe
# for both paths (fresh DB and incremental upgrade).
BASELINE_TABLES = (
    "users", "organizations", "memberships", "identities", "auth_sessions", "org_invites",
    "sport_profiles", "points_rules", "tiebreak_rulesets",
    "tournaments", "divisions", "stages", "groups", "rounds",
    "teams", "roster_entries", "squads", "squad_members",
    "participants", "registrations", "pairing_requests",
    "matches", "match_participants", "match_result_events", "standings",
    "venues", "courts", "schedule_slots", "assignments",
    "share_links", "files", "notifications", "outbox", "audit_logs", "idempotency_keys",
)


def _baseline_tables() -> list:
    names = set(BASELINE_TABLES)
    return [t for t in Base.metadata.sorted_tables if t.name in names]


def upgrade() -> None:
    bind = op.get_bind()
    version = int(bind.exec_driver_sql("SHOW server_version_num").scalar())
    if version < MIN_PG_VERSION_NUM:
        raise RuntimeError(f"PostgreSQL 15+ required; connected server is {version}.")
    tables = _baseline_tables()
    # 1. ENUM types first (columns reference them with create_type=False).
    for enum_type in ALL_PG_ENUMS:
        enum_type.create(bind, checkfirst=True)
    # contest_kind is owned by migration 0016 but referenced by matches (a baseline
    # table) — create it here so create_all succeeds on a completely fresh database.
    # Migration 0016 uses checkfirst=True, so the two-step creation is idempotent.
    CONTEST_KIND.create(bind, checkfirst=True)
    # 2. Baseline tables, FKs, indexes, generated/unique/check constraints.
    Base.metadata.create_all(bind, tables=tables)
    # 3. Row-Level Security: ENABLE + FORCE + org-isolation policies.
    for statement in rls.upgrade_statements(BASELINE_TABLES):
        op.execute(statement)
    # 4. DB-side updated_at trigger on every baseline table (all have updated_at).
    for statement in triggers.upgrade_statements([t.name for t in tables]):
        op.execute(statement)


def downgrade() -> None:
    bind = op.get_bind()
    tables = _baseline_tables()
    # Reverse order: triggers -> policies/RLS -> tables -> ENUM types.
    for statement in triggers.downgrade_statements([t.name for t in tables]):
        op.execute(statement)
    for statement in rls.downgrade_statements(BASELINE_TABLES):
        op.execute(statement)
    Base.metadata.drop_all(bind, tables=tables)
    for enum_type in reversed(ALL_PG_ENUMS):
        enum_type.drop(bind, checkfirst=True)
