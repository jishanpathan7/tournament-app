"""notification priority, icon, cta, resolved_at columns

Adds priority/icon/cta/resolved_at to notifications for the new organizer
notification architecture. Non-destructive: existing rows get safe defaults
(priority='info', icon='bell', nulls for cta/resolved_at).

Also adds RESOLVED value to notification_status and creates notification_priority
enum.

Revision ID: 0019_notification_priority
Revises: 0018_org_emails_enabled
Create Date: 2026-07-09
"""

from __future__ import annotations

from alembic import op

revision = "0019_notification_priority"
down_revision = "0018_org_emails_enabled"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # New priority enum type — guard against re-entrant runs (CI reuses DB between jobs)
    op.execute(
        "DO $$ BEGIN "
        "  CREATE TYPE notification_priority AS ENUM ('action_required', 'important', 'info'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; "
        "END $$"
    )

    # Add RESOLVED value to notification_status enum
    # Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
    # Alembic runs in autocommit mode for DDL so this is safe.
    op.execute("ALTER TYPE notification_status ADD VALUE IF NOT EXISTS 'resolved'")

    # New columns on notifications (all nullable or with safe server defaults)
    op.execute(
        "ALTER TABLE notifications "
        "ADD COLUMN IF NOT EXISTS priority notification_priority NOT NULL DEFAULT 'info', "
        "ADD COLUMN IF NOT EXISTS icon VARCHAR(64) NOT NULL DEFAULT 'bell', "
        "ADD COLUMN IF NOT EXISTS cta_label VARCHAR(80), "
        "ADD COLUMN IF NOT EXISTS cta_href VARCHAR(512), "
        "ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE notifications "
        "DROP COLUMN IF EXISTS resolved_at, "
        "DROP COLUMN IF EXISTS cta_href, "
        "DROP COLUMN IF EXISTS cta_label, "
        "DROP COLUMN IF EXISTS icon, "
        "DROP COLUMN IF EXISTS priority"
    )
    op.execute("DROP TYPE IF EXISTS notification_priority")
    # Note: cannot remove enum values from notification_status in PG without recreating type.
    # Downgrade leaves 'resolved' value in place (harmless).
