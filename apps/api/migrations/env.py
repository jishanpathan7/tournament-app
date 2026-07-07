"""Alembic environment — async, targets app.core.db.Base.metadata."""

import asyncio
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import get_settings
from app.db.base import Base

import app.db.models  # noqa: F401  # registers all tables on Base.metadata

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

_LOCAL_DEFAULT = "postgresql+asyncpg://tournament:tournament@localhost:5432/tournament"


def _url() -> str:
    """Return the migration connection URL.

    Migrations must run against the **direct** (non-pooled) Neon endpoint
    to avoid PgBouncer prepared-statement conflicts.  Set ``DIRECT_URL`` in
    production (Railway env); the app's pooled ``DATABASE_URL`` is used as a
    fallback in dev/CI where a connection pooler is not in the path.

    Neon direct URLs use the ``postgresql://`` scheme; we normalise to
    ``postgresql+asyncpg://`` so SQLAlchemy's async engine accepts them.
    """
    url = os.environ.get("DIRECT_URL") or get_settings().database_url or _LOCAL_DEFAULT
    # Normalise bare postgresql:// → postgresql+asyncpg:// for the async engine.
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]
    return url


def run_migrations_offline() -> None:
    context.configure(
        url=_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def _do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    engine = create_async_engine(_url())
    async with engine.connect() as connection:
        await connection.run_sync(_do_run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
