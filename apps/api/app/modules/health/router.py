from datetime import datetime, timezone

from fastapi import APIRouter, Response, status

from app.core.config import get_settings
from app.core.db import check_db

from .schemas import DBHealthResponse, HealthResponse, ReadinessResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Liveness — the process is up (no dependency checks). Always 200."""
    settings = get_settings()
    return HealthResponse(
        status="ok",
        service=settings.app_name,
        version=settings.version,
        environment=settings.environment,
        time=datetime.now(timezone.utc),
    )


@router.get("/health/db", response_model=DBHealthResponse)
async def health_db() -> DBHealthResponse:
    return DBHealthResponse(database="ok" if await check_db() else "unavailable")


@router.get("/health/ready", response_model=ReadinessResponse)
async def health_ready(response: Response) -> ReadinessResponse:
    """Readiness — dependencies reachable. 503 when not ready (for load-balancer probes)."""
    db_ok = await check_db()
    if not db_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return ReadinessResponse(
        status="ok" if db_ok else "unavailable",
        checks={"database": "ok" if db_ok else "unavailable"},
    )
