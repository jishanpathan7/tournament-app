"""files: add metadata JSONB (image dimensions etc.) captured on upload-complete

Additive, forward-only — does not touch the 0001 baseline. The baseline's
create_all builds ``files`` from the current ORM model, which already declares
``metadata``, so a fresh ``upgrade head`` already has the column; IF NOT EXISTS
makes this a no-op there and a real ADD on already-migrated databases.

Revision ID: 0003_files_metadata
Revises: 0002_auth_identity
Create Date: 2026-07-01
"""

from __future__ import annotations

from alembic import op

revision = "0003_files_metadata"
down_revision = "0002_auth_identity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE files ADD COLUMN IF NOT EXISTS metadata JSONB")


def downgrade() -> None:
    op.execute("ALTER TABLE files DROP COLUMN IF EXISTS metadata")
