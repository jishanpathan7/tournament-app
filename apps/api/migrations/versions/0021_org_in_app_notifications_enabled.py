"""add in_app_notifications_enabled to organizations

Adds a Boolean kill-switch column so an organizer can disable all in-app
notifications for their account in one toggle. Mirrors emails_enabled.
Defaults to TRUE so no existing org is affected by this migration.

Revision ID: 0021_org_in_app_notifications_enabled
Revises: 0020_tournament_members
Create Date: 2026-07-10
"""

from __future__ import annotations

from alembic import op

revision = "0021_org_in_app_notifs"
down_revision = "0020_tournament_members"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE organizations "
        "ADD COLUMN IF NOT EXISTS in_app_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE organizations DROP COLUMN IF EXISTS in_app_notifications_enabled"
    )
