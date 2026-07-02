"""scheduling: court status + tournament_courts assignment + match duration

Additive, forward-only. Court / ScheduleSlot / Assignment already exist from the
0001 baseline, and Match already carries `court_id` / `scheduled_at` — this
migration adds only what's missing for organizer-facing scheduling: an
operational status per court (active/maintenance/disabled), an explicit
court-to-tournament assignment (distinct from the finer-grained per-window
availability already modeled by `schedule_slots`), and a match duration
estimate so a court's occupied window can be computed for conflict detection
and the schedule timeline.

Revision ID: 0010_scheduling
Revises: 0009_public_tournament_read_policy
Create Date: 2026-07-02
"""

from __future__ import annotations

from alembic import op

from app.db import triggers
from app.db.enums import COURT_STATUS
from app.db.models import TournamentCourt
from app.db.rls import tenant_table_downgrade_statements, tenant_table_upgrade_statements

revision = "0010_scheduling"
down_revision = "0009_public_read_policy"
branch_labels = None
depends_on = None

_TABLE = "tournament_courts"


def upgrade() -> None:
    bind = op.get_bind()
    COURT_STATUS.create(bind, checkfirst=True)
    op.execute(
        "ALTER TABLE courts ADD COLUMN IF NOT EXISTS status court_status "
        "NOT NULL DEFAULT 'active'"
    )
    op.execute("ALTER TABLE matches ADD COLUMN IF NOT EXISTS duration_minutes INTEGER")
    # Same naive->aware fix as 0005 (notifications.sent_at): the scheduling service
    # writes tz-aware datetimes; a fresh DB already gets timestamptz from the ORM model.
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'matches' AND column_name = 'scheduled_at'
              AND data_type = 'timestamp without time zone'
          ) THEN
            ALTER TABLE matches
              ALTER COLUMN scheduled_at TYPE timestamptz
              USING scheduled_at AT TIME ZONE 'UTC';
          END IF;
        END $$;
        """
    )

    TournamentCourt.__table__.create(bind, checkfirst=True)
    op.execute(triggers.create_trigger(_TABLE))
    for stmt in tenant_table_upgrade_statements(_TABLE):
        op.execute(stmt)


def downgrade() -> None:
    bind = op.get_bind()
    for stmt in tenant_table_downgrade_statements(_TABLE):
        op.execute(stmt)
    op.execute(triggers.drop_trigger(_TABLE))
    TournamentCourt.__table__.drop(bind, checkfirst=True)

    op.execute("ALTER TABLE matches DROP COLUMN IF EXISTS duration_minutes")
    op.execute("ALTER TABLE courts DROP COLUMN IF EXISTS status")
    COURT_STATUS.drop(bind, checkfirst=True)
