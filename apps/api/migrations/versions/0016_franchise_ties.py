"""franchise ties: squad participants, match containers, leg rollup

Revision ID: 0016_franchise_ties
Revises: 0015_checkin_links
Create Date: 2026-07-03
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0016_franchise_ties"
down_revision = "0015_checkin_links"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PG cannot use a newly added enum label in the same transaction (CHECK below).
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE participant_kind ADD VALUE IF NOT EXISTS 'squad'")

    contest_kind = postgresql.ENUM(
        "standard", "tie", "leg", name="contest_kind", create_type=True
    )
    contest_kind.create(op.get_bind(), checkfirst=True)

    # participants.squad_id
    op.add_column(
        "participants",
        sa.Column("squad_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_participants_squad_id",
        "participants",
        "squads",
        ["squad_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_participants_squad_id", "participants", ["squad_id"])

    op.drop_constraint("participant_kind_refs", "participants", type_="check")
    op.create_check_constraint(
        "participant_kind_refs",
        "participants",
        "(kind = 'individual' AND user_id IS NOT NULL AND team_id IS NULL AND squad_id IS NULL) "
        "OR (kind IN ('pair', 'team') AND team_id IS NOT NULL AND user_id IS NULL AND squad_id IS NULL) "
        "OR (kind = 'squad' AND squad_id IS NOT NULL AND user_id IS NULL AND team_id IS NULL)",
    )

    # matches.parent_match_id + contest_kind
    op.add_column(
        "matches",
        sa.Column(
            "contest_kind",
            sa.Enum("standard", "tie", "leg", name="contest_kind", create_type=False),
            nullable=False,
            server_default="standard",
        ),
    )
    op.add_column(
        "matches",
        sa.Column("parent_match_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_matches_parent_match_id",
        "matches",
        "matches",
        ["parent_match_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_matches_parent_match_id", "matches", ["parent_match_id"])


def downgrade() -> None:
    op.drop_index("ix_matches_parent_match_id", table_name="matches")
    op.drop_constraint("fk_matches_parent_match_id", "matches", type_="foreignkey")
    op.drop_column("matches", "parent_match_id")
    op.drop_column("matches", "contest_kind")
    op.execute("DROP TYPE IF EXISTS contest_kind")

    op.drop_constraint("participant_kind_refs", "participants", type_="check")
    op.create_check_constraint(
        "participant_kind_refs",
        "participants",
        "(kind = 'individual' AND user_id IS NOT NULL AND team_id IS NULL) "
        "OR (kind IN ('pair', 'team') AND team_id IS NOT NULL AND user_id IS NULL)",
    )
    op.drop_index("ix_participants_squad_id", table_name="participants")
    op.drop_constraint("fk_participants_squad_id", "participants", type_="foreignkey")
    op.drop_column("participants", "squad_id")
    # participant_kind 'squad' value is left in place (PG enums are append-only)
