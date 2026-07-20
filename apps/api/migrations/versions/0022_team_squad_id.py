"""teams: link a pair back to the squad it was drafted from

A doubles pair (``teams``) had no reference to the franchise squad its players
came from, so surfaces that wanted to show squad identity fell back to
``Team.name`` — which for a pair is the pair's own name ("A / B"). Store the
squad on the pair at publish time instead.

Idempotent in both directions. ``teams`` is a baseline table built by 0001 via
``Base.metadata.create_all``, so on a FRESH database the column, index and FK
already exist by the time this runs; only an existing database needs them added.
Guarding both paths keeps ``upgrade -> downgrade -> upgrade`` clean.

Nullable: pairs published before this migration have no recorded squad, and the
link is re-established the next time pairs are published.

Revision ID: 0022_team_squad_id
Revises: a18c57ae9099
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0022_team_squad_id"
down_revision: Union[str, None] = "a18c57ae9099"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE teams ADD COLUMN IF NOT EXISTS squad_id UUID")
    op.execute("CREATE INDEX IF NOT EXISTS ix_teams_squad_id ON teams (squad_id)")
    # ADD CONSTRAINT has no IF NOT EXISTS; check the catalog first.
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_teams_squad_id_squads'
            ) THEN
                ALTER TABLE teams
                ADD CONSTRAINT fk_teams_squad_id_squads
                FOREIGN KEY (squad_id) REFERENCES squads (id) ON DELETE SET NULL;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    # Drop the FK before 0014 drops `squads`, or that table cannot be removed.
    op.execute("ALTER TABLE teams DROP CONSTRAINT IF EXISTS fk_teams_squad_id_squads")
    op.execute("DROP INDEX IF EXISTS ix_teams_squad_id")
    op.execute("ALTER TABLE teams DROP COLUMN IF EXISTS squad_id")
