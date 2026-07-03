"""Registration import: reusable column-mapping templates + a record of each committed
import batch (for audit/history). The parse→map→validate→dedupe→commit pipeline itself
is stateless (preview never persists); only saved templates and completed batches live here.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import OrgScopedMixin, TimestampMixin, UUIDPrimaryKeyMixin


class MappingTemplate(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    """A saved, reusable mapping of import-source columns → participant fields, so an
    organizer doesn't re-map the same SurveyMonkey export each event. ``source`` is an
    open string (e.g. ``surveymonkey_csv``) so new providers reuse this table unchanged."""

    __tablename__ = "mapping_templates"
    __table_args__ = (UniqueConstraint("organization_id", "name"),)

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    source: Mapped[str] = mapped_column(String(40), nullable=False)
    # {targetField: sourceColumn} — e.g. {"displayName": "Full Name", "skillLevel": "Level"}.
    mapping: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )


class ImportBatch(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    """A record of one committed import into a division — how many rows were created /
    updated / skipped, and by whom. Kept for the organizer's import history + audit."""

    __tablename__ = "import_batches"

    division_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("divisions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source: Mapped[str] = mapped_column(String(40), nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    imported_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    updated_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    skipped_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
