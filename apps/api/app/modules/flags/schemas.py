"""Feature-flag API schemas (camelCase on the wire)."""

from __future__ import annotations

import datetime
import uuid

from pydantic import Field

from app.api.schemas import ApiModel


class UpsertFeatureFlagRequest(ApiModel):
    key: str = Field(min_length=1, max_length=120)
    enabled: bool = True
    rollout_percentage: int = Field(default=100, ge=0, le=100)
    description: str | None = None


class FeatureFlagResource(ApiModel):
    id: uuid.UUID
    key: str
    scope: str  # global | organization | user
    scope_id: uuid.UUID | None
    enabled: bool
    rollout_percentage: int
    description: str | None
    created_at: datetime.datetime


class FlagEnabledResponse(ApiModel):
    key: str
    enabled: bool
