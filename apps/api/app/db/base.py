"""Declarative base + metadata for all ORM models.

`Base.metadata` carries a naming convention so every implicitly-named constraint
and index gets a deterministic name. This keeps Alembic autogenerate diffs clean
and downgrades stable. Alembic's ``target_metadata`` points here (migrations/env.py).
"""

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

# https://alembic.sqlalchemy.org/en/latest/naming.html
# %(column_0_N_name)s uses all columns so composite (org_id-leading) names read well.
NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_N_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Declarative base for all ORM models (Alembic targets this metadata)."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)
