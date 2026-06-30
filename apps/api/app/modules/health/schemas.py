from datetime import datetime

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    environment: str
    time: datetime


class DBHealthResponse(BaseModel):
    database: str  # "ok" | "unavailable"
