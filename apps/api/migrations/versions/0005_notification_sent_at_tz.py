"""notifications: convert sent_at to timestamptz (the dispatcher writes tz-aware values)

Additive, forward-only, idempotent — the same naive→aware fix applied to
outbox.processed_at in 0004. Skipped on fresh DBs where create_all already built
sent_at as timestamptz.

Revision ID: 0005_notification_sent_at_tz
Revises: 0004_outbox_retry
Create Date: 2026-07-01
"""

from __future__ import annotations

from alembic import op

revision = "0005_notification_sent_at_tz"
down_revision = "0004_outbox_retry"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'notifications' AND column_name = 'sent_at'
              AND data_type = 'timestamp without time zone'
          ) THEN
            ALTER TABLE notifications
              ALTER COLUMN sent_at TYPE timestamptz
              USING sent_at AT TIME ZONE 'UTC';
          END IF;
        END $$;
        """
    )


def downgrade() -> None:
    # Leaving the column as timestamptz on downgrade is harmless; no-op.
    pass
