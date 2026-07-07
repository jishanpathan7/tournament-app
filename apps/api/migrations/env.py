"""Alembic environment — async, targets app.core.db.Base.metadata."""

import asyncio
import os
from logging.config import fileConfig
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

import app.db.models  # noqa: F401  # registers all tables on Base.metadata
from app.core.config import get_settings
from app.db.base import Base

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

_LOCAL_DEFAULT = "postgresql+asyncpg://tournament:tournament@localhost:5432/tournament"


def _url() -> tuple[str, dict]:
    """Return (clean_url, connect_args) for the migration engine.

    Migrations run against the **direct** (non-pooled) Neon endpoint to avoid
    PgBouncer prepared-statement conflicts.  Set ``DIRECT_URL`` in Railway;
    ``DATABASE_URL`` is the fallback in dev/CI.

    Neon URLs include libpq params (``sslmode``, ``channel_binding``) that
    asyncpg rejects.  We strip them and translate sslmode → ssl connect_arg.
    """
    url = os.environ.get("DIRECT_URL") or get_settings().database_url or _LOCAL_DEFAULT
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://") :]

    parsed = urlparse(url)
    params = parse_qs(parsed.query, keep_blank_values=True)
    sslmode = params.pop("sslmode", ["disable"])[0]
    params.pop("channel_binding", None)
    clean_url = urlunparse(parsed._replace(query=urlencode({k: v[0] for k, v in params.items()})))

    connect_args: dict = {"statement_cache_size": 0}
    if sslmode in {"require", "verify-ca", "verify-full"}:
        connect_args["ssl"] = True

    return clean_url, connect_args


def run_migrations_offline() -> None:
    clean_url, _ = _url()
    context.configure(
        url=clean_url,
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
    clean_url, connect_args = _url()
    engine = create_async_engine(clean_url, connect_args=connect_args)
    async with engine.connect() as connection:
        await connection.run_sync(_do_run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
