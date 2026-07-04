"""squads: franchise team groupings before pairing

Revision ID: 0014_squads
Revises: 0013_scorekeeper_link
Create Date: 2026-07-03
"""

from __future__ import annotations

from alembic import op

from app.db import triggers
from app.db.models.squads import Squad, SquadMember
from app.db.rls import tenant_table_downgrade_statements, tenant_table_upgrade_statements

revision = "0014_squads"
down_revision = "0013_scorekeeper_link"
branch_labels = None
depends_on = None

_TABLES = ("squads", "squad_members")


def upgrade() -> None:
    bind = op.get_bind()
    Squad.__table__.create(bind, checkfirst=True)
    SquadMember.__table__.create(bind, checkfirst=True)
    for table in _TABLES:
        op.execute(triggers.create_trigger(table))
        for stmt in tenant_table_upgrade_statements(table):
            op.execute(stmt)


def downgrade() -> None:
    for table in _TABLES:
        for stmt in tenant_table_downgrade_statements(table):
            op.execute(stmt)
        op.execute(triggers.drop_trigger(table))
    bind = op.get_bind()
    SquadMember.__table__.drop(bind, checkfirst=True)
    Squad.__table__.drop(bind, checkfirst=True)
