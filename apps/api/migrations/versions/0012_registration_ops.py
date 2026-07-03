"""registration ops: participant attendance + import mapping/batch tables

Additive, forward-only. Adds event-day attendance to participants (an attendance
status independent of the registration-lifecycle `status`, plus a checked_in_at
timestamp), and the two tables the pluggable import pipeline needs: reusable
column-mapping templates and a record of each committed import batch. Both new
tables are tenant-strict (RLS-managed) with the standard updated_at trigger.

Revision ID: 0012_registration_ops
Revises: 0011_pairing_runs
Create Date: 2026-07-03
"""

from __future__ import annotations

from alembic import op

from app.db import triggers
from app.db.enums import ATTENDANCE_STATUS
from app.db.models import ImportBatch, MappingTemplate
from app.db.rls import tenant_table_downgrade_statements, tenant_table_upgrade_statements

revision = "0012_registration_ops"
down_revision = "0011_pairing_runs"
branch_labels = None
depends_on = None

_TABLES = ("mapping_templates", "import_batches")


def upgrade() -> None:
    bind = op.get_bind()
    ATTENDANCE_STATUS.create(bind, checkfirst=True)
    op.execute(
        "ALTER TABLE participants ADD COLUMN IF NOT EXISTS attendance attendance_status "
        "NOT NULL DEFAULT 'pending'"
    )
    op.execute(
        "ALTER TABLE participants ADD COLUMN IF NOT EXISTS checked_in_at "
        "TIMESTAMP WITH TIME ZONE"
    )

    MappingTemplate.__table__.create(bind, checkfirst=True)
    ImportBatch.__table__.create(bind, checkfirst=True)
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
    ImportBatch.__table__.drop(bind, checkfirst=True)
    MappingTemplate.__table__.drop(bind, checkfirst=True)

    op.execute("ALTER TABLE participants DROP COLUMN IF EXISTS checked_in_at")
    op.execute("ALTER TABLE participants DROP COLUMN IF EXISTS attendance")
    ATTENDANCE_STATUS.drop(bind, checkfirst=True)
