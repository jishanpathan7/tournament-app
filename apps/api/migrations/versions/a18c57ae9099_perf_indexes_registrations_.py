"""perf_indexes_registrations_notifications_pairing_runs

Revision ID: a18c57ae9099
Revises: 0021_org_in_app_notifs
Create Date: 2026-07-13 23:24:32.504288
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a18c57ae9099'
down_revision: Union[str, None] = '0021_org_in_app_notifs'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_notifications_recipient_status",
        "notifications",
        ["recipient_user_id", "status"],
        unique=False,
    )
    op.create_index(
        "ix_pairing_runs_config_gin",
        "pairing_runs",
        ["config"],
        unique=False,
        postgresql_using="gin",
    )
    op.create_index(
        "ix_registrations_division_status",
        "registrations",
        ["division_id", "status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_registrations_submitted_by"),
        "registrations",
        ["submitted_by"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_registrations_submitted_by"), table_name="registrations")
    op.drop_index("ix_registrations_division_status", table_name="registrations")
    op.drop_index("ix_pairing_runs_config_gin", table_name="pairing_runs")
    op.drop_index("ix_notifications_recipient_status", table_name="notifications")
