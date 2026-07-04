"""share_links: division-scoped check-in links

Revision ID: 0015_checkin_links
Revises: 0014_squads
Create Date: 2026-07-03
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0015_checkin_links"
down_revision = "0014_squads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "share_links",
        sa.Column("division_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_share_links_division_id",
        "share_links",
        "divisions",
        ["division_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_share_links_division_id", "share_links", ["division_id"])


def downgrade() -> None:
    op.drop_index("ix_share_links_division_id", table_name="share_links")
    op.drop_constraint("fk_share_links_division_id", "share_links", type_="foreignkey")
    op.drop_column("share_links", "division_id")
