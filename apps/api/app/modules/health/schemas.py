from datetime import datetime

from app.api.schemas import ApiModel


class HealthResponse(ApiModel):
    status: str
    service: str
    version: str
    environment: str
    time: datetime


class DBHealthResponse(ApiModel):
    database: str  # "ok" | "unavailable"


class ReadinessResponse(ApiModel):
    status: str  # "ok" | "unavailable"
    checks: dict[str, str]  # component -> "ok" | "unavailable"
