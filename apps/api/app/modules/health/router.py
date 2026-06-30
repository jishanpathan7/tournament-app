from datetime import datetime, timezone

from fastapi import APIRouter

from app.core.config import get_settings
from app.core.db import check_db

from .schemas import DBHealthResponse, HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
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
