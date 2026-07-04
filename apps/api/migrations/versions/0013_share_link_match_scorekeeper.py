"""share_links: match-scoped scorekeeper invites

Adds match_id + recipient metadata so organizers can issue one revocable link per
match for court-side scoring without creating org user accounts.

Revision ID: 0013_scorekeeper_link
Revises: 0012_registration_ops
Create Date: 2026-07-03
"""

from __future__ import annotations

from alembic import op

revision = "0013_scorekeeper_link"
down_revision = "0012_registration_ops"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # IF NOT EXISTS makes every step idempotent: on a fresh DB, migration 0001
    # already created share_links with the current model (all columns included).
    op.execute("ALTER TABLE share_links ADD COLUMN IF NOT EXISTS match_id UUID")
    op.execute(
        "ALTER TABLE share_links ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(320)"
    )
    op.execute(
        "ALTER TABLE share_links ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(200)"
    )
    op.execute("ALTER TABLE share_links ADD COLUMN IF NOT EXISTS created_by UUID")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_share_links_match_id ON share_links(match_id)"
    )
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_share_links_match_id'
            ) THEN
                ALTER TABLE share_links
                    ADD CONSTRAINT fk_share_links_match_id
                    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE;
            END IF;
        END $$
    """)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_share_links_created_by'
            ) THEN
                ALTER TABLE share_links
                    ADD CONSTRAINT fk_share_links_created_by
                    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
            END IF;
        END $$
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_share_links_match_id")
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_share_links_created_by'
            ) THEN
                ALTER TABLE share_links DROP CONSTRAINT fk_share_links_created_by;
            END IF;
        END $$
    """)
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_share_links_match_id'
            ) THEN
                ALTER TABLE share_links DROP CONSTRAINT fk_share_links_match_id;
            END IF;
        END $$
    """)
    op.execute("ALTER TABLE share_links DROP COLUMN IF EXISTS created_by")
    op.execute("ALTER TABLE share_links DROP COLUMN IF EXISTS recipient_name")
    op.execute("ALTER TABLE share_links DROP COLUMN IF EXISTS recipient_email")
    op.execute("ALTER TABLE share_links DROP COLUMN IF EXISTS match_id")
