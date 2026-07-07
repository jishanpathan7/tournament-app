"""add emails_enabled to organizations

Adds a Boolean kill-switch column so an organizer can disable all outbound
email notifications for their account and tournaments in one toggle.
Defaults to TRUE so no existing org is affected by this migration.

Revision ID: 0017_org_emails_enabled
Revises: 0016_franchise_ties
Create Date: 2026-07-07
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0017_org_emails_enabled"
down_revision = "0016_franchise_ties"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE organizations "
        "ADD COLUMN IF NOT EXISTS emails_enabled BOOLEAN NOT NULL DEFAULT TRUE"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE organizations DROP COLUMN IF EXISTS emails_enabled")
