"""Shared column helpers for ORM models.

`uuid7` is re-exported so models depend on ``app.db.types`` rather than the
``uuid6`` package directly (one swap point if the generator ever changes).
"""

from uuid6 import uuid7

__all__ = ["uuid7"]
