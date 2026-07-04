"""Row-Level Security: SQL builders + the table classification the migration uses.

Classification (the deliberate scope of RLS preparation):

  TENANT_STRICT      NOT NULL organization_id, isolated to one org. ENABLE + FORCE;
                     policy compares organization_id to the session's org context.
  GLOBAL_OR_TENANT   nullable organization_id (seeded global catalog + org-owned
                     overrides). ENABLE + FORCE; readable when global OR own-org,
                     writable own-org only.
  NO_RLS             identity / bootstrap / system / capability tables that are read
                     BEFORE an org context exists — login, creating an org,
                     enumerating your memberships, resolving a public share-link
                     shortcode — or by a context-less system poller (outbox).
                     Guarded by the app/auth layer, not RLS. Listed so the choice
                     is explicit, not accidental.

GOTCHAS:
  * FORCE is required because the app/migrations connect as the table OWNER, who
    otherwise bypasses RLS. On local docker the ``tournament`` role is a SUPERUSER,
    which bypasses RLS unconditionally (even with FORCE) — so RLS can only be
    *observed* by connecting as a non-superuser role (see tests/test_rls.py).
  * With FORCE and no org context set, a tenant query returns ZERO rows.
  * Seeding GLOBAL_OR_TENANT rows (organization_id IS NULL) must go through a
    superuser / BYPASSRLS path — the WITH CHECK forbids tenants writing globals.

The policy reads the org context defensively: ``NULLIF(..., '')::uuid`` so an
unset (NULL) or cleared ('') context yields NULL (rows hidden) instead of a
``invalid input syntax for uuid`` error.
"""

from __future__ import annotations

from collections.abc import Container

# organization_id-scoped operational domain tables (NOT NULL org_id).
TENANT_STRICT_TABLES = [
    "tournaments",
    "divisions",
    "stages",
    "groups",
    "rounds",
    "teams",
    "roster_entries",
    "squads",
    "squad_members",
    "participants",
    "registrations",
    "pairing_requests",
    "pairing_runs",
    "proposed_teams",
    "mapping_templates",
    "import_batches",
    "matches",
    "match_participants",
    "match_result_events",
    "standings",
    "venues",
    "courts",
    "tournament_courts",
    "schedule_slots",
    "assignments",
    "files",
    "notifications",
    "audit_logs",
    "idempotency_keys",
]

# Global catalog (NULL org_id) + optional org-owned rows.
GLOBAL_OR_TENANT_TABLES = ["sport_profiles", "points_rules", "tiebreak_rulesets"]

# Deliberately NOT RLS-managed — see module docstring.
NO_RLS_TABLES = [
    "users",
    "organizations",
    "memberships",
    "identities",
    "auth_sessions",
    "auth_tokens",
    "org_invites",
    "outbox",
    "share_links",
    "feature_flags",
]

_ORG = "NULLIF(current_setting('app.current_org', true), '')::uuid"


def _enable_force(table: str) -> list[str]:
    return [
        f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;",
        f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;",
    ]


def _tenant_policy(table: str) -> str:
    return (
        f"CREATE POLICY {table}_org_isolation ON {table} "
        f"USING (organization_id = {_ORG}) "
        f"WITH CHECK (organization_id = {_ORG});"
    )


def _tenant_or_global_policy(table: str) -> str:
    return (
        f"CREATE POLICY {table}_org_isolation ON {table} "
        f"USING (organization_id IS NULL OR organization_id = {_ORG}) "
        f"WITH CHECK (organization_id = {_ORG});"
    )


def upgrade_statements(tables: Container[str] | None = None) -> list[str]:
    """ENABLE + FORCE + policy for every RLS-managed table.

    ``tables``, when given, restricts the sweep to that subset — the 0001 baseline
    passes its own pinned ``BASELINE_TABLES`` so it stays correct as later migrations
    (e.g. 0010) extend ``TENANT_STRICT_TABLES`` with tables the baseline never creates.
    """
    strict = (
        TENANT_STRICT_TABLES if tables is None else [t for t in TENANT_STRICT_TABLES if t in tables]
    )
    glob = (
        GLOBAL_OR_TENANT_TABLES
        if tables is None
        else [t for t in GLOBAL_OR_TENANT_TABLES if t in tables]
    )
    stmts: list[str] = []
    for table in strict:
        stmts.extend(_enable_force(table))
        stmts.append(_tenant_policy(table))
    for table in glob:
        stmts.extend(_enable_force(table))
        stmts.append(_tenant_or_global_policy(table))
    return stmts


def downgrade_statements(tables: Container[str] | None = None) -> list[str]:
    """Drop policies + disable RLS (run before dropping the tables). See ``tables``
    above."""
    all_tables = TENANT_STRICT_TABLES + GLOBAL_OR_TENANT_TABLES
    scoped = all_tables if tables is None else [t for t in all_tables if t in tables]
    stmts: list[str] = []
    for table in scoped:
        stmts.append(f"DROP POLICY IF EXISTS {table}_org_isolation ON {table};")
        stmts.append(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
    return stmts


def tenant_table_upgrade_statements(table: str) -> list[str]:
    """ENABLE + FORCE + policy for a single tenant-strict table added in a later
    migration (i.e. not part of the 0001 baseline's ``upgrade_statements()`` sweep).
    ``table`` must also be added to ``TENANT_STRICT_TABLES`` so the classification
    stays exhaustive (see ``tests/test_db_metadata.py``)."""
    return [*_enable_force(table), _tenant_policy(table)]


def tenant_table_downgrade_statements(table: str) -> list[str]:
    return [
        f"DROP POLICY IF EXISTS {table}_org_isolation ON {table};",
        f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;",
    ]


# ---- public microsite bootstrap ----
#
# A single, narrow, additive exception: the public microsite needs to resolve a
# tournament by slug *before* it knows (or is allowed to assume) which org owns it —
# there is no org context to set yet. Postgres combines multiple permissive policies
# on the same table with OR, so this is a second policy on `tournaments` alongside
# `tournaments_org_isolation`, not a replacement for it: an authenticated request
# still only sees its own org's rows (first policy); an anonymous request (no org
# context — the ``NULLIF`` collapses to NULL, so the first policy's comparison is
# never true) additionally sees rows with visibility 'public' or 'unlisted'.
#
# 'private' tournaments stay invisible to anonymous reads. 'unlisted' is deliberately
# included here (reachable by direct slug link) but the app layer excludes it from
# search results — this policy only decides *can Postgres return the row at all*, not
# *should this feature list it*. Once the public module resolves a tournament this
# way, it sets `app.current_org` to that tournament's real (now-verified) org for the
# rest of the request, so every other table's normal org-isolation policy applies —
# this is the only table that needs the extra policy.

PUBLIC_READABLE_VISIBILITIES = "'public', 'unlisted'"


def _public_read_policy(table: str) -> str:
    return (
        f"CREATE POLICY {table}_public_read ON {table} "
        f"FOR SELECT USING (visibility IN ({PUBLIC_READABLE_VISIBILITIES}));"
    )


def public_read_upgrade_statements() -> list[str]:
    return [_public_read_policy("tournaments")]


def public_read_downgrade_statements() -> list[str]:
    return ["DROP POLICY IF EXISTS tournaments_public_read ON tournaments;"]
