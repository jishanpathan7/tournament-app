"""DB-side `updated_at` maintenance.

`TimestampMixin.updated_at` uses SQLAlchemy's ``onupdate`` — which only fires on
ORM unit-of-work flushes. The hot write paths here are bulk/Core statements
(standings recompute, marking outbox rows processed, notification status
transitions, idempotency completion), which would otherwise leave ``updated_at``
frozen at insert time and silently break cache-invalidation / "what changed since"
sync / debugging. A ``BEFORE UPDATE`` trigger makes ``updated_at`` authoritative on
every write path. The ORM ``onupdate`` is kept as a harmless complement.

Applied to every table that has an ``updated_at`` column (computed from metadata in
the initial migration, so the set can't drift).
"""

from __future__ import annotations

SET_UPDATED_AT_FUNCTION = (
    "CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$ "
    "BEGIN NEW.updated_at = now(); RETURN NEW; END; "
    "$$ LANGUAGE plpgsql;"
)


def _trigger_name(table: str) -> str:
    return f"trg_{table}_set_updated_at"


def create_trigger(table: str) -> str:
    """One CREATE OR REPLACE TRIGGER (idempotent; PG 14+ / we require 15+)."""
    return (
        f"CREATE OR REPLACE TRIGGER {_trigger_name(table)} BEFORE UPDATE ON {table} "
        f"FOR EACH ROW EXECUTE FUNCTION set_updated_at();"
    )


def drop_trigger(table: str) -> str:
    """One DROP TRIGGER (leaves the shared function in place)."""
    return f"DROP TRIGGER IF EXISTS {_trigger_name(table)} ON {table};"


def upgrade_statements(tables: list[str]) -> list[str]:
    return [SET_UPDATED_AT_FUNCTION, *(create_trigger(t) for t in tables)]


def downgrade_statements(tables: list[str]) -> list[str]:
    return [*(drop_trigger(t) for t in tables), "DROP FUNCTION IF EXISTS set_updated_at();"]
