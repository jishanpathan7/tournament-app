"""Async SQLAlchemy engine/session. Lazily initialized so the app boots without a DB.

`Base` is defined in ``app.db.base`` and re-exported here for back-compat. ORM models
register on ``Base.metadata`` (imported via ``app.db.models``); Alembic targets it.
"""

from collections.abc import AsyncGenerator, AsyncIterator
from contextlib import asynccontextmanager
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.db.base import Base

__all__ = ["Base", "get_session", "check_db", "check_rls_enforcement"]


_engine = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None

# asyncpg does not accept libpq query-string params (sslmode, channel_binding).
# Strip them from the URL and translate sslmode → ssl connect_arg instead.
_ASYNCPG_UNSUPPORTED_PARAMS = {"sslmode", "channel_binding"}
_SSL_MODES = {"require", "verify-ca", "verify-full"}


def _prepare_url(url: str) -> tuple[str, dict]:
    """Return (clean_url, connect_args) suitable for asyncpg.

    Neon connection strings include ``?sslmode=require&channel_binding=require``
    which asyncpg rejects.  We strip those params and pass ssl=True via
    connect_args when sslmode was require/verify-*.
    """
    parsed = urlparse(url)
    params = parse_qs(parsed.query, keep_blank_values=True)
    sslmode = params.pop("sslmode", ["disable"])[0]
    for key in list(_ASYNCPG_UNSUPPORTED_PARAMS):
        params.pop(key, None)
    clean_url = urlunparse(parsed._replace(query=urlencode({k: v[0] for k, v in params.items()})))
    connect_args: dict = {"statement_cache_size": 0}
    if sslmode in _SSL_MODES:
        connect_args["ssl"] = True
    return clean_url, connect_args


def _init() -> None:
    global _engine, _sessionmaker
    settings = get_settings()
    if settings.database_url and _engine is None:
        clean_url, connect_args = _prepare_url(settings.database_url)
        _engine = create_async_engine(
            clean_url,
            future=True,
            pool_pre_ping=True,
            connect_args=connect_args,
            # Supabase transaction pooler (PgBouncer) handles the real
            # Postgres connection limit — app-side pool can be larger.
            # pool_timeout lowered so requests fail fast rather than queuing.
            pool_size=10,
            max_overflow=20,
            pool_timeout=10,
            pool_recycle=300,
        )
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


async def check_rls_enforcement() -> None:
    """Assert the connected DB role is not a superuser.

    Postgres superusers bypass Row-Level Security, so a superuser connection
    would silently defeat all tenant isolation. This check runs at startup in
    production and raises immediately so the deployment fails loud rather than
    serving data without any RLS enforcement.
    """
    _init()
    if _engine is None:
        raise RuntimeError("DATABASE_URL is not configured")
    async with _engine.connect() as conn:
        row = await conn.execute(text("SELECT current_user, current_setting('is_superuser')"))
        current_user, is_superuser = row.one()
    if is_superuser == "on":
        raise RuntimeError(
            f"Database role '{current_user}' is a superuser — "
            "superusers bypass Row-Level Security. "
            "Create a non-superuser application role and set DATABASE_URL accordingly."
        )


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
