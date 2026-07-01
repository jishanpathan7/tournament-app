"""Outbox event types for the notification aggregate."""

from __future__ import annotations

AGGREGATE = "notification"

DISPATCH = "notification.dispatch"  # deliver a pending notification via its channel
