"""squads: franchise team groupings before pairing

Revision ID: 0014_squads
Revises: 0013_scorekeeper_link
Create Date: 2026-07-03
"""

from __future__ import annotations

from alembic import op

from app.db import triggers
from app.db.models.squads import Squad, SquadMember
from app.db.rls import tenant_table_downgrade_statements, tenant_table_upgrade_statements

revision = "0014_squads"
down_revision = "0013_scorekeeper_link"
branch_labels = None
depends_on = None

_TABLES = ("squads", "squad_members")


_NEW_CONSTRAINT_SQL = (
    "(kind = 'individual' AND team_id IS NULL AND squad_id IS NULL)"
    " OR (kind IN ('pair', 'team') AND team_id IS NOT NULL"
    " AND user_id IS NULL AND squad_id IS NULL)"
    " OR (kind = 'squad' AND squad_id IS NOT NULL"
    " AND user_id IS NULL AND team_id IS NULL)"
)


def upgrade() -> None:
    bind = op.get_bind()
    # checkfirst=True: no-op on fresh DBs where 0001 already created these tables
    # (squads is in 0001's BASELINE_TABLES because participants.squad_id FK depends on it).
    Squad.__table__.create(bind, checkfirst=True)
    SquadMember.__table__.create(bind, checkfirst=True)
    # Incremental upgrade path: add squad_id to the existing participants table.
    # IF NOT EXISTS is idempotent — on fresh DBs the column was already created by
    # 0001 via Base.metadata.create_all (which uses the current model including squad_id).
    op.execute(
        "ALTER TABLE participants "
        "ADD COLUMN IF NOT EXISTS squad_id UUID "
        "REFERENCES squads(id) ON DELETE RESTRICT"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_participants_squad_id ON participants(squad_id)"
    )
    # Replace the check constraint: the new one adds squad_id clauses and drops the
    # requirement that individual participants must have user_id (imported players may not
    # have a platform account yet). Drop-then-recreate is idempotent — on fresh DBs
    # create_all already installed the new constraint, so we just recreate it.
    op.execute(
        "ALTER TABLE participants "
        "DROP CONSTRAINT IF EXISTS ck_participants_participant_kind_refs"
    )
    op.execute(
        "ALTER TABLE participants ADD CONSTRAINT ck_participants_participant_kind_refs "
        f"CHECK ({_NEW_CONSTRAINT_SQL})"
    )
    for table in _TABLES:
        op.execute(triggers.create_trigger(table))
        for stmt in tenant_table_upgrade_statements(table):
            op.execute(stmt)
    # Replace the plain unique constraint on tournaments(org, slug) with a partial
    # index that excludes soft-deleted rows so slugs can be reused after deletion.
    # IF NOT EXISTS / IF EXISTS make both steps idempotent for fresh and existing DBs.
    op.execute(
        "ALTER TABLE tournaments "
        "DROP CONSTRAINT IF EXISTS uq_tournaments_organization_id_slug"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_tournaments_organization_id_slug "
        "ON tournaments(organization_id, slug) WHERE deleted_at IS NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_tournaments_organization_id_slug")
    op.execute(
        "ALTER TABLE tournaments "
        "ADD CONSTRAINT uq_tournaments_organization_id_slug "
        "UNIQUE (organization_id, slug)"
    )
    for table in _TABLES:
        for stmt in tenant_table_downgrade_statements(table):
            op.execute(stmt)
        op.execute(triggers.drop_trigger(table))
    op.drop_column("participants", "squad_id")
    bind = op.get_bind()
    SquadMember.__table__.drop(bind, checkfirst=True)
    Squad.__table__.drop(bind, checkfirst=True)
