"""participants: add email, phone, gender, partner_preference for editable player profiles

These fields make Participant the canonical player record so edits propagate
everywhere automatically (matches, standings, public pages) without JSONB sync.
At approval time they are populated from form_response; thereafter only Participant
is updated.

Idempotent via IF NOT EXISTS — safe to run against both fresh and existing databases.

Revision ID: 0023_participant_contact_fields
Revises: 0022_team_squad_id
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0023_participant_contact_fields"
down_revision: Union[str, None] = "0022_team_squad_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE participants ADD COLUMN IF NOT EXISTS email VARCHAR(254)")
    op.execute("ALTER TABLE participants ADD COLUMN IF NOT EXISTS phone VARCHAR(40)")
    op.execute("ALTER TABLE participants ADD COLUMN IF NOT EXISTS gender VARCHAR(20)")
    op.execute(
        "ALTER TABLE participants ADD COLUMN IF NOT EXISTS partner_preference VARCHAR(200)"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE participants DROP COLUMN IF EXISTS partner_preference")
    op.execute("ALTER TABLE participants DROP COLUMN IF EXISTS gender")
    op.execute("ALTER TABLE participants DROP COLUMN IF EXISTS phone")
    op.execute("ALTER TABLE participants DROP COLUMN IF EXISTS email")
