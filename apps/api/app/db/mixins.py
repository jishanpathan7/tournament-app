"""Reusable column mixins for ORM models.

In SQLAlchemy 2.0 a ``mapped_column`` declared on a mixin is copied onto each
mapped subclass, so these compose cleanly via multiple inheritance.
"""

from __future__ import annotations

import datetime
import uuid

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.types import uuid7


class UUIDPrimaryKeyMixin:
    """Time-ordered UUIDv7 primary key, generated app-side via ``uuid7``."""

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)


class TimestampMixin:
    """``created_at`` / ``updated_at`` — timezone-aware, DB-stamped."""

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class OrgScopedMixin:
    """NOT NULL ``organization_id`` FK + index.

    Every tenant table carries it (denormalized onto child tables) so its RLS
    policy is self-contained. Cross-tenant FK is ON DELETE RESTRICT.
    """

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )


class SoftDeleteMixin:
    """Nullable ``deleted_at`` for soft-deletable aggregates."""

    deleted_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
