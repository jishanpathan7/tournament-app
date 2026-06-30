"""FastAPI application factory and entrypoint (`uvicorn app.main:app`)."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute

from app.api import api_router
from app.api.errors import register_exception_handlers
from app.api.middleware import RequestContextMiddleware
from app.core.config import get_settings
from app.core.logging import configure_logging

logger = logging.getLogger("app")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.log_level)
    if settings.sentry_dsn:
        import sentry_sdk

        sentry_sdk.init(dsn=settings.sentry_dsn, traces_sample_rate=0.1)
    logger.info("api.startup", extra={"environment": settings.environment})
    yield
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
    register_exception_handlers(app)
    # Pure-ASGI request-id/correlation context (runs around every request).
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )
    app.include_router(api_router)
    return app


app = create_app()
