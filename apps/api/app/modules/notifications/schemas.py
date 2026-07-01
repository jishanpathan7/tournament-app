"""Notification API schemas (camelCase on the wire)."""

from __future__ import annotations

import datetime
import uuid

from app.api.schemas import ApiModel


class NotificationResource(ApiModel):
    id: uuid.UUID
    type: str
    title: str | None
    body: str | None
    status: str  # sent | delivered | failed | read
    created_at: datetime.datetime


class UnreadCountResponse(ApiModel):
    count: int


class MarkAllReadResponse(ApiModel):
    updated: int
