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

# organization_id-scoped operational domain tables (NOT NULL org_id).
TENANT_STRICT_TABLES = [
    "tournaments",
    "divisions",
    "stages",
    "groups",
    "rounds",
    "teams",
    "roster_entries",
    "participants",
    "registrations",
    "pairing_requests",
    "matches",
    "match_participants",
    "match_result_events",
    "standings",
    "venues",
    "courts",
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
    "org_invites",
    "outbox",
    "share_links",
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


def upgrade_statements() -> list[str]:
    """ENABLE + FORCE + policy for every RLS-managed table."""
    stmts: list[str] = []
    for table in TENANT_STRICT_TABLES:
        stmts.extend(_enable_force(table))
        stmts.append(_tenant_policy(table))
    for table in GLOBAL_OR_TENANT_TABLES:
        stmts.extend(_enable_force(table))
        stmts.append(_tenant_or_global_policy(table))
    return stmts


def downgrade_statements() -> list[str]:
    """Drop policies + disable RLS (run before dropping the tables)."""
    stmts: list[str] = []
    for table in TENANT_STRICT_TABLES + GLOBAL_OR_TENANT_TABLES:
        stmts.append(f"DROP POLICY IF EXISTS {table}_org_isolation ON {table};")
        stmts.append(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
    return stmts
