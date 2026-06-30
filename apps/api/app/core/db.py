"""Async SQLAlchemy engine/session. Lazily initialized so the app boots without a DB."""

from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings


class Base(DeclarativeBase):
    """Declarative base for all ORM models (Alembic targets this metadata)."""


_engine = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def _init() -> None:
    global _engine, _sessionmaker
    settings = get_settings()
    if settings.database_url and _engine is None:
        _engine = create_async_engine(settings.database_url, future=True, pool_pre_ping=True)
        _sessionmaker = async_sessionmaker(_engine, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding a scoped async session."""
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
