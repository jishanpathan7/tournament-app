"""tournaments: additive RLS policy for anonymous public reads

Adds a second, permissive SELECT policy on `tournaments` (Postgres OR-combines
multiple permissive policies on the same table): visibility IN ('public',
'unlisted'). This is what lets the public microsite resolve a tournament by slug
with no org context set — see `app.db.rls` module docstring for the full reasoning.
The existing `tournaments_org_isolation` policy is untouched; authenticated,
org-scoped reads behave exactly as before.

Revision ID: 0009_public_read_policy
Revises: 0008_tournament_timestamps_tz
Create Date: 2026-07-02
"""

from __future__ import annotations

from alembic import op

from app.db import rls

revision = "0009_public_read_policy"
down_revision = "0008_tournament_timestamps_tz"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for statement in rls.public_read_upgrade_statements():
        op.execute(statement)


def downgrade() -> None:
    for statement in rls.public_read_downgrade_statements():
        op.execute(statement)
