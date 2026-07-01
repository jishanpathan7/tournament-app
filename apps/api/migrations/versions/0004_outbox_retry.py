"""outbox: add attempts + last_error for the in-process job poller's retry/dead-letter

Additive, forward-only. The 0001 baseline's create_all builds ``outbox`` from the
current model (which now declares these), so a fresh ``upgrade head`` already has
them; IF NOT EXISTS makes this a no-op there and a real ADD on migrated databases.

Revision ID: 0004_outbox_retry
Revises: 0003_files_metadata
Create Date: 2026-07-01
"""

from __future__ import annotations

from alembic import op

revision = "0004_outbox_retry"
down_revision = "0003_files_metadata"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE outbox ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE outbox ADD COLUMN IF NOT EXISTS last_error TEXT")
    # processed_at was originally naive TIMESTAMP; the poller writes tz-aware values.
    # Convert to timestamptz (interpreting existing values as UTC). Idempotent: skipped
    # on fresh DBs where create_all already built it as timestamptz.
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'outbox' AND column_name = 'processed_at'
              AND data_type = 'timestamp without time zone'
          ) THEN
            ALTER TABLE outbox
              ALTER COLUMN processed_at TYPE timestamptz
              USING processed_at AT TIME ZONE 'UTC';
          END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE outbox DROP COLUMN IF EXISTS last_error")
    op.execute("ALTER TABLE outbox DROP COLUMN IF EXISTS attempts")
