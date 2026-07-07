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
    # 0001_initial_schema builds tables from live ORM metadata, so on a fresh DB
    # these columns already exist. Use IF NOT EXISTS for idempotency.
    op.execute("ALTER TABLE venues ADD COLUMN IF NOT EXISTS maps_url TEXT")
    op.execute(
        "ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS"
        " venue_id UUID REFERENCES venues(id) ON DELETE SET NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_tournaments_venue_id ON tournaments(venue_id)"
    )


def downgrade() -> None:
    op.drop_column("tournaments", "venue_id")
    op.drop_column("venues", "maps_url")
