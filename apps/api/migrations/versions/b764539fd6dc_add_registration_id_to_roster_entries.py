"""add registration_id to roster_entries

Revision ID: b764539fd6dc
Revises: 0023_participant_contact_fields
Create Date: 2026-07-30 01:51:31.798944
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b764539fd6dc'
down_revision: Union[str, None] = '0023_participant_contact_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('roster_entries', sa.Column('registration_id', sa.UUID(), nullable=True))
    op.create_index(
        op.f('ix_roster_entries_registration_id'),
        'roster_entries',
        ['registration_id'],
        unique=False,
    )
    op.create_foreign_key(
        op.f('fk_roster_entries_registration_id_registrations'),
        'roster_entries',
        'registrations',
        ['registration_id'],
        ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f('fk_roster_entries_registration_id_registrations'),
        'roster_entries',
        type_='foreignkey',
    )
    op.drop_index(op.f('ix_roster_entries_registration_id'), table_name='roster_entries')
    op.drop_column('roster_entries', 'registration_id')
