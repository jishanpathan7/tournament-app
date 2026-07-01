"""feature flags: feature_flag_scope enum + feature_flags table

Additive, forward-only — a new table + enum, not part of the 0001 baseline (the
baseline's create_all is pinned to its own table list). Built straight from the ORM
model so it matches metadata exactly, plus its updated_at trigger.

Revision ID: 0006_feature_flags
Revises: 0005_notification_sent_at_tz
Create Date: 2026-07-01
"""

from __future__ import annotations

from alembic import op

from app.db import triggers
from app.db.enums import FEATURE_FLAG_SCOPE
from app.db.models import FeatureFlag

revision = "0006_feature_flags"
down_revision = "0005_notification_sent_at_tz"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    FEATURE_FLAG_SCOPE.create(bind, checkfirst=True)  # column is create_type=False
    FeatureFlag.__table__.create(bind, checkfirst=True)
    op.execute(triggers.create_trigger("feature_flags"))


def downgrade() -> None:
    bind = op.get_bind()
    op.execute(triggers.drop_trigger("feature_flags"))
    FeatureFlag.__table__.drop(bind, checkfirst=True)
    FEATURE_FLAG_SCOPE.drop(bind, checkfirst=True)
