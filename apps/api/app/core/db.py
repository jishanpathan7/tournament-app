"""Async SQLAlchemy engine/session. Lazily initialized so the app boots without a DB.

`Base` is defined in ``app.db.base`` and re-exported here for back-compat. ORM models
register on ``Base.metadata`` (imported via ``app.db.models``); Alembic targets it.
"""

from collections.abc import AsyncGenerator, AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.db.base import Base

__all__ = ["Base", "get_session", "check_db"]


_engine = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def _init() -> None:
    global _engine, _sessionmaker
    settings = get_settings()
    if settings.database_url and _engine is None:
        _engine = create_async_engine(settings.database_url, future=True, pool_pre_ping=True)
        _sessionmaker = async_sessionmaker(_engine, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding a scoped async session.

    RLS hook: once the auth layer resolves a request principal, it will call
    ``app.db.session.set_org_context(session, org_id)`` here (inside a transaction)
    so Postgres RLS is scoped per request. Until then, tenant tables are FORCE'd
    and a query without an org context returns zero rows (not an error).
    """
    _init()
    if _sessionmaker is None:
        raise RuntimeError("DATABASE_URL is not configured")
    async with _sessionmaker() as session:
        yield session


def reset_engine() -> None:
    """Drop the cached engine/sessionmaker so the next use rebuilds them. Used by
    tests after schema-recreating migrations, whose new type OIDs would otherwise
    leave the pooled connections' asyncpg type cache stale."""
    global _engine, _sessionmaker
    _engine = None
    _sessionmaker = None


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    """An INDEPENDENT session (own connection/transaction), for work that must
    persist regardless of the request transaction — e.g. revoking a token family on
    refresh-reuse detection, which commits before the handler raises and rolls back."""
    _init()
    if _sessionmaker is None:
        raise RuntimeError("DATABASE_URL is not configured")
    async with _sessionmaker() as session:
        yield session


async def check_db() -> bool:
    """Return True if the database answers a trivial query; never raises."""
    _init()
    if _engine is None:
        return False
    try:
        async with _engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:  # noqa: BLE001 - health probe must not propagate
        return False
