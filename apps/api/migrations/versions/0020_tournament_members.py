"""tournament_members and tournament_invites tables

Adds collaborative tournament management: per-tournament role assignments and
email-based invites. tournament_role and tournament_invite_status enums created here.

Non-destructive. Existing data and permissions are unaffected.

Revision ID: 0020_tournament_members
Revises: 0019_notification_priority
Create Date: 2026-07-10
"""

from __future__ import annotations

from alembic import op

revision = "0020_tournament_members"
down_revision = "0019_notification_priority"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "DO $$ BEGIN "
        "  CREATE TYPE tournament_role AS ENUM ("
        "    'tournament_admin', 'organizer', 'court_manager',"
        "    'checkin_staff', 'scorekeeper', 'viewer'"
        "  ); "
        "EXCEPTION WHEN duplicate_object THEN NULL; "
        "END $$"
    )
    op.execute(
        "DO $$ BEGIN "
        "  CREATE TYPE tournament_invite_status AS ENUM ("
        "    'pending', 'accepted', 'revoked', 'expired'"
        "  ); "
        "EXCEPTION WHEN duplicate_object THEN NULL; "
        "END $$"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS tournament_members (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            tournament_id   UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
            user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            tournament_role tournament_role NOT NULL,
            invited_by      UUID REFERENCES users(id) ON DELETE SET NULL,
            accepted_at     TIMESTAMPTZ,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (tournament_id, user_id)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_tournament_members_tournament_id"
        " ON tournament_members (tournament_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_tournament_members_user_id"
        " ON tournament_members (user_id)"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS tournament_invites (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            tournament_id   UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
            email           VARCHAR(320) NOT NULL,
            tournament_role tournament_role NOT NULL,
            token_hash      VARCHAR(255) NOT NULL UNIQUE,
            invited_by      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            status          tournament_invite_status NOT NULL DEFAULT 'pending',
            expires_at      TIMESTAMPTZ NOT NULL,
            accepted_at     TIMESTAMPTZ,
            accepted_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_tournament_invites_tournament_id"
        " ON tournament_invites (tournament_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_tournament_invites_email"
        " ON tournament_invites (email)"
    )

    # RLS — same org-isolation policy as other TENANT_STRICT tables
    for table in ("tournament_members", "tournament_invites"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"DROP POLICY IF EXISTS {table}_org_isolation ON {table}")
        op.execute(
            f"CREATE POLICY {table}_org_isolation ON {table} "
            f"USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid) "
            f"WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)"
        )


def downgrade() -> None:
    for table in ("tournament_invites", "tournament_members"):
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
    op.execute("DROP TYPE IF EXISTS tournament_invite_status")
    op.execute("DROP TYPE IF EXISTS tournament_role")
