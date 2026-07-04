"""franchise ties: squad participants, match containers, leg rollup

Revision ID: 0016_franchise_ties
Revises: 0015_checkin_links
Create Date: 2026-07-03
"""

from __future__ import annotations

from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0016_franchise_ties"
down_revision = "0015_checkin_links"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PG cannot use a newly added enum label in the same transaction.
    # IF NOT EXISTS is idempotent: on fresh DBs the value was already added
    # by migration 0001 (which creates the current model with 'squad' in the enum).
    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TYPE participant_kind ADD VALUE IF NOT EXISTS 'squad'"
        )

    # Create the contest_kind PG enum type if it does not already exist.
    # On incremental upgrades (DB at 0012) the type does not exist yet.
    # On fresh DBs migration 0001 creates the matches table which references this
    # type — SQLAlchemy emits it with create_type=False, so it is *not* created
    # by create_all; migration 0016 is responsible for creating it.
    contest_kind = postgresql.ENUM(
        "standard", "tie", "leg", name="contest_kind", create_type=True
    )
    contest_kind.create(op.get_bind(), checkfirst=True)

    # Note: squad_id on participants and the participant_kind_refs check constraint
    # are handled entirely by migration 0014 (squads).  Doing it there avoids a
    # circular dependency between 0014 (which creates squads) and 0016 (which adds
    # squad participants), and keeps each migration self-contained.

    # matches.contest_kind — NOT NULL with a server default so it back-fills existing rows.
    op.execute(
        "ALTER TABLE matches ADD COLUMN IF NOT EXISTS "
        "contest_kind contest_kind NOT NULL DEFAULT 'standard'"
    )
    # matches.parent_match_id — self-referencing FK for tie-legs inside a parent match.
    op.execute(
        "ALTER TABLE matches ADD COLUMN IF NOT EXISTS parent_match_id UUID"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_matches_parent_match_id "
        "ON matches(parent_match_id)"
    )
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_matches_parent_match_id'
            ) THEN
                ALTER TABLE matches
                    ADD CONSTRAINT fk_matches_parent_match_id
                    FOREIGN KEY (parent_match_id) REFERENCES matches(id) ON DELETE CASCADE;
            END IF;
        END $$
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_matches_parent_match_id")
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_matches_parent_match_id'
            ) THEN
                ALTER TABLE matches DROP CONSTRAINT fk_matches_parent_match_id;
            END IF;
        END $$
    """)
    op.execute("ALTER TABLE matches DROP COLUMN IF EXISTS parent_match_id")
    op.execute("ALTER TABLE matches DROP COLUMN IF EXISTS contest_kind")
    op.execute("DROP TYPE IF EXISTS contest_kind")
    # participant_kind 'squad' value is intentionally left in place — PG enums are append-only.
