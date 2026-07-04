"""share_links: match-scoped scorekeeper invites

Adds match_id + recipient metadata so organizers can issue one revocable link per
match for court-side scoring without creating org user accounts.

Revision ID: 0013_scorekeeper_link
Revises: 0012_registration_ops
Create Date: 2026-07-03
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0013_scorekeeper_link"
down_revision = "0012_registration_ops"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "share_links",
        sa.Column("match_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column("share_links", sa.Column("recipient_email", sa.String(320), nullable=True))
    op.add_column("share_links", sa.Column("recipient_name", sa.String(200), nullable=True))
    op.add_column(
        "share_links",
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_share_links_match_id",
        "share_links",
        "matches",
        ["match_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_share_links_created_by",
        "share_links",
        "users",
        ["created_by"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_share_links_match_id", "share_links", ["match_id"])


def downgrade() -> None:
    op.drop_index("ix_share_links_match_id", table_name="share_links")
    op.drop_constraint("fk_share_links_created_by", "share_links", type_="foreignkey")
    op.drop_constraint("fk_share_links_match_id", "share_links", type_="foreignkey")
    op.drop_column("share_links", "created_by")
    op.drop_column("share_links", "recipient_name")
    op.drop_column("share_links", "recipient_email")
    op.drop_column("share_links", "match_id")
