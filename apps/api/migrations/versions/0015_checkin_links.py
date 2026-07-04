"""share_links: division-scoped check-in links

Revision ID: 0015_checkin_links
Revises: 0014_squads
Create Date: 2026-07-03
"""

from __future__ import annotations

from alembic import op

revision = "0015_checkin_links"
down_revision = "0014_squads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # IF NOT EXISTS is idempotent for fresh-DB runs where migration 0001 already
    # created share_links with the current model (all columns present).
    op.execute(
        "ALTER TABLE share_links ADD COLUMN IF NOT EXISTS division_id UUID"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_share_links_division_id "
        "ON share_links(division_id)"
    )
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_share_links_division_id'
            ) THEN
                ALTER TABLE share_links
                    ADD CONSTRAINT fk_share_links_division_id
                    FOREIGN KEY (division_id) REFERENCES divisions(id) ON DELETE CASCADE;
            END IF;
        END $$
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_share_links_division_id")
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_share_links_division_id'
            ) THEN
                ALTER TABLE share_links DROP CONSTRAINT fk_share_links_division_id;
            END IF;
        END $$
    """)
    op.execute("ALTER TABLE share_links DROP COLUMN IF EXISTS division_id")
