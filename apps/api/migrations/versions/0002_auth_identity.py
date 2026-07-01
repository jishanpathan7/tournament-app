"""auth: email verification + last-login on users, and the auth_tokens table

Additive, forward-only — does not touch the 0001 baseline. Adds:
  - enum ``auth_token_purpose`` (email_verification | password_reset),
  - nullable ``users.email_verified_at`` and ``users.last_login_at``,
  - the ``auth_tokens`` table (NO_RLS, single-use expiring tokens), built straight
    from the ORM model so it matches metadata exactly, plus its updated_at trigger.

Revision ID: 0002_auth_identity
Revises: 0001_initial
Create Date: 2026-07-01
"""

from __future__ import annotations

from alembic import op

from app.db import triggers
from app.db.enums import AUTH_TOKEN_PURPOSE
from app.db.models import AuthToken

revision = "0002_auth_identity"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    AUTH_TOKEN_PURPOSE.create(bind, checkfirst=True)
    # IF NOT EXISTS: the 0001 baseline's create_all builds `users` from the current
    # model, which already declares these columns, so a fresh `upgrade head` has them.
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ")
    AuthToken.__table__.create(bind, checkfirst=True)  # matches metadata exactly
    op.execute(triggers.create_trigger("auth_tokens"))  # shared function already exists (0001)


def downgrade() -> None:
    bind = op.get_bind()
    op.execute(triggers.drop_trigger("auth_tokens"))  # leave the shared function in place
    AuthToken.__table__.drop(bind, checkfirst=True)
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS last_login_at")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS email_verified_at")
    AUTH_TOKEN_PURPOSE.drop(bind, checkfirst=True)
