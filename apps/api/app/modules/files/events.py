"""Outbox event types for the files aggregate."""

from __future__ import annotations

AGGREGATE = "file"

FILE_READY = "file.ready"  # emitted when an upload is confirmed and marked ready
