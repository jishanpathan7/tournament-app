"""tournaments: convert date/publication columns to timestamptz

Additive, forward-only, idempotent — the same naive→aware fix applied to
outbox.processed_at (0004) and notifications.sent_at (0005). The domain API accepts
tz-aware datetimes (start/end dates) and stamps tz-aware publication times; these
columns were naive TIMESTAMP. Skipped on fresh DBs where create_all already builds
them as timestamptz.

Revision ID: 0008_tournament_timestamps_tz
Revises: 0007_match_status_pending
Create Date: 2026-07-01
"""

from __future__ import annotations

from alembic import op

revision = "0008_tournament_timestamps_tz"
down_revision = "0007_match_status_pending"
branch_labels = None
depends_on = None

_COLUMNS = (
    "starts_at",
    "ends_at",
    "draw_published_at",
    "schedule_published_at",
    "results_published_at",
)


def upgrade() -> None:
    for column in _COLUMNS:
        op.execute(
            f"""
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'tournaments' AND column_name = '{column}'
                  AND data_type = 'timestamp without time zone'
              ) THEN
                ALTER TABLE tournaments
                  ALTER COLUMN {column} TYPE timestamptz
                  USING {column} AT TIME ZONE 'UTC';
              END IF;
            END $$;
            """
        )


def downgrade() -> None:
    # Leaving the columns as timestamptz is harmless; no-op.
    pass
