"""venue: add maps_url to venues, add venue_id FK to tournaments

Revision ID: 0017_venue_tournament_fk
Revises: 0016_franchise_ties
Create Date: 2026-07-05
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0017_venue_tournament_fk"
down_revision = "0016_franchise_ties"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("venues", sa.Column("maps_url", sa.Text(), nullable=True))
    op.add_column(
        "tournaments",
        sa.Column(
            "venue_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("venues.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("tournaments", "venue_id")
    op.drop_column("venues", "maps_url")
