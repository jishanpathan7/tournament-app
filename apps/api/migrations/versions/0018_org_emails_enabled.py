"""add emails_enabled to organizations

Adds a Boolean kill-switch column so an organizer can disable all outbound
email notifications for their account and tournaments in one toggle.
Defaults to TRUE so no existing org is affected by this migration.

Revision ID: 0018_org_emails_enabled
Revises: 0017_venue_tournament_fk
Create Date: 2026-07-07
"""

from __future__ import annotations

from alembic import op

revision = "0018_org_emails_enabled"
down_revision = "0017_venue_tournament_fk"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE organizations "
        "ADD COLUMN IF NOT EXISTS emails_enabled BOOLEAN NOT NULL DEFAULT TRUE"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE organizations DROP COLUMN IF EXISTS emails_enabled")
