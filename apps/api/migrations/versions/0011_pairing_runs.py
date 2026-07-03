"""pairing: Smart Pairing staging tables (pairing_runs + proposed_teams)

Additive, forward-only — not part of the 0001 baseline. Adds the staging tables the
Smart Pairing Engine writes its draft teams into (a run + its proposed teams), so a
generated batch can be reviewed/edited/regenerated before it materializes into real
Team + pair Participant rows on publish. Both tenant-strict (RLS-managed) with the
standard updated_at trigger.

Revision ID: 0011_pairing_runs
Revises: 0010_scheduling
Create Date: 2026-07-02
"""

from __future__ import annotations

from alembic import op

from app.db import triggers
from app.db.enums import PAIRING_RUN_STATUS
from app.db.models import PairingRun, ProposedTeam
from app.db.rls import tenant_table_downgrade_statements, tenant_table_upgrade_statements

revision = "0011_pairing_runs"
down_revision = "0010_scheduling"
branch_labels = None
depends_on = None

_TABLES = ("pairing_runs", "proposed_teams")


def upgrade() -> None:
    bind = op.get_bind()
    PAIRING_RUN_STATUS.create(bind, checkfirst=True)
    # pairing_runs first (proposed_teams FKs it).
    PairingRun.__table__.create(bind, checkfirst=True)
    ProposedTeam.__table__.create(bind, checkfirst=True)
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
    ProposedTeam.__table__.drop(bind, checkfirst=True)
    PairingRun.__table__.drop(bind, checkfirst=True)
    PAIRING_RUN_STATUS.drop(bind, checkfirst=True)
