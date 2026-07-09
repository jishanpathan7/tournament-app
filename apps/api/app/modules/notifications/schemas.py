"""Notification API schemas (camelCase on the wire)."""

from __future__ import annotations

import datetime
import uuid

from app.api.schemas import ApiModel


class NotificationResource(ApiModel):
    id: uuid.UUID
    type: str
    priority: str  # action_required | important | info
    icon: str
    title: str | None
    body: str | None
    cta_label: str | None
    cta_href: str | None
    status: str  # sent | delivered | failed | read | resolved
    resolved_at: datetime.datetime | None
    created_at: datetime.datetime


class UnreadCountResponse(ApiModel):
    count: int


class MarkAllReadResponse(ApiModel):
    updated: int


class ResolveNotificationResponse(ApiModel):
    id: uuid.UUID
    status: str
