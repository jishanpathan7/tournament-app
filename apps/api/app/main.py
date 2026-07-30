"""FastAPI application factory and entrypoint (`uvicorn app.main:app`)."""

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
from slowapi.middleware import SlowAPIMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.api import api_router
from app.api.errors import register_exception_handlers
from app.api.middleware import RequestContextMiddleware
from app.core.config import get_settings
from app.core.db import check_rls_enforcement
from app.core.limiter import limiter
from app.core.logging import configure_logging

logger = logging.getLogger("app")


async def run_migrations() -> None:
    """Run Alembic migrations (`upgrade head`) against DIRECT_URL.

    This used to run as a Railway `preDeployCommand`, but pre-deploy executes
    in a temporary build container with no route to the private network —
    the Supabase connection failed with "Network is unreachable". Running it
    here, at app startup, guarantees the service already has network access
    (migrations/env.py reads DIRECT_URL exactly as before).

    Alembic's env.py drives its own event loop via `asyncio.run(...)`, which
    cannot be called from within an already-running loop (the FastAPI
    lifespan), so the upgrade is offloaded to a worker thread.
    """
    from alembic import command
    from alembic.config import Config

    def _upgrade() -> None:
        alembic_ini = Path(__file__).resolve().parent.parent / "alembic.ini"
        cfg = Config(str(alembic_ini))
        command.upgrade(cfg, "head")

    logger.info("api.migrations.start")
    await asyncio.to_thread(_upgrade)
    logger.info("api.migrations.complete")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.log_level)
    if settings.sentry_dsn:
        import sentry_sdk

        sentry_sdk.init(dsn=settings.sentry_dsn, traces_sample_rate=0.1)

    if settings.database_url:
        await run_migrations()

    # In-process background job poller (single-instance MVP). Set WORKER_ENABLED=false
    # to instead run a standalone worker (`python -m app.workers`).
    worker_stop: asyncio.Event | None = None
    worker_task: asyncio.Task[None] | None = None
    if settings.worker_enabled and settings.database_url:
        from app.workers.poller import run_forever

        worker_stop = asyncio.Event()
        worker_task = asyncio.create_task(run_forever(worker_stop))

    # In production, assert the DB role is not a superuser and that RLS is
    # enforced (superusers bypass RLS, defeating all tenant isolation).
    if settings.is_production and settings.database_url:
        await check_rls_enforcement()

    logger.info("api.startup", extra={"environment": settings.environment})
    yield
    if worker_stop is not None and worker_task is not None:
        worker_stop.set()
        await worker_task
    logger.info("api.shutdown")


def _operation_id(route: APIRoute) -> str:
    """Stable, client-friendly operation ids `<tag>_<name>` (e.g. health_health) so the
    generated TypeScript client gets readable method names instead of FastAPI defaults."""
    tag = str(route.tags[0]) if route.tags else "default"
    return f"{tag}_{route.name}"


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=settings.version,
        lifespan=lifespan,
        generate_unique_id_function=_operation_id,
    )
    app.state.limiter = limiter
    register_exception_handlers(app)
    app.add_middleware(SlowAPIMiddleware)
    # Honour X-Forwarded-For / X-Real-IP set by Railway/Render's load balancer so
    # the login throttle and audit logs see the actual client IP, not the proxy.
    # trusted_hosts="*" is safe here: Railway terminates TLS and strips/rewrites
    # these headers before they reach the app, so end-users cannot spoof them.
    app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")
    # Pure-ASGI request-id/correlation context (runs around every request).
    app.add_middleware(RequestContextMiddleware)
    cors_origins = settings.cors_origin_list
    if "*" in cors_origins:
        raise ValueError(
            "CORS_ORIGINS must not contain '*' when allow_credentials=True — "
            "browsers reject credentialed CORS against wildcard origins. "
            "Set explicit HTTPS origins instead."
        )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )
    app.include_router(api_router)
    return app


app = create_app()
