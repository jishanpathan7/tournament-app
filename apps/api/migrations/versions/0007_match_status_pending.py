"""matches: add 'pending' to the match_status enum (unresolved bracket sides)

Additive, forward-only. A knockout match exists before its participants are known
(source_refs winner_of/bye); it sits in 'pending' until the AdvancementEngine resolves
its sides. On a fresh DB the 0001 baseline builds match_status from the current model
(which now includes 'pending'), so ADD VALUE IF NOT EXISTS is a no-op there.

Revision ID: 0007_match_status_pending
Revises: 0006_feature_flags
Create Date: 2026-07-01
"""

from __future__ import annotations

from alembic import op

revision = "0007_match_status_pending"
down_revision = "0006_feature_flags"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE match_status ADD VALUE IF NOT EXISTS 'pending'")


def downgrade() -> None:
    # Postgres cannot drop an enum value; nothing to do (forward-only).
    pass
