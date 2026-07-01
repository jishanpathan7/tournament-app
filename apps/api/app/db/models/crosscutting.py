"""Cross-cutting: ShareLink, File, Notification, Outbox, AuditLog, IdempotencyKey.

`outbox` is a system table (no org_id, no RLS) — the in-process poller reads all
rows; the org id travels in the event payload. `audit_logs` references entities by
(entity, entity_id) text/uuid with no FK, so audit survives subtree deletion.
"""

from __future__ import annotations

import datetime
import uuid
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.enums import (
    FEATURE_FLAG_SCOPE,
    FILE_KIND,
    FILE_STATUS,
    IDEMPOTENCY_STATUS,
    NOTIFICATION_CHANNEL,
    NOTIFICATION_STATUS,
    SHARE_LINK_SCOPE,
)
from app.db.mixins import OrgScopedMixin, TimestampMixin, UUIDPrimaryKeyMixin


class ShareLink(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    """Signed, scoped, revocable capability resolved at /public/t/{shortcode}."""

    __tablename__ = "share_links"

    tournament_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tournaments.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    scope: Mapped[str] = mapped_column(SHARE_LINK_SCOPE, nullable=False)
    shortcode: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime.datetime | None] = mapped_column(nullable=True)
    revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))


class File(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    __tablename__ = "files"

    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
    kind: Mapped[str] = mapped_column(FILE_KIND, nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    content_type: Mapped[str] = mapped_column(String(160), nullable=False)
    size: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default=text("0"))
    status: Mapped[str] = mapped_column(
        FILE_STATUS, nullable=False, server_default=text("'pending'")
    )
    # Extracted on upload-complete: image dims etc. Attribute is `meta` because
    # `metadata` is reserved by the Declarative API; the DB column stays `metadata`.
    meta: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB, nullable=True)


class Notification(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    __tablename__ = "notifications"

    recipient_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(Text, nullable=False)
    channel: Mapped[str] = mapped_column(NOTIFICATION_CHANNEL, nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    status: Mapped[str] = mapped_column(
        NOTIFICATION_STATUS, nullable=False, server_default=text("'pending'")
    )
    sent_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class Outbox(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Transactional outbox (system table). Written in the same tx as the business row."""

    __tablename__ = "outbox"
    __table_args__ = (
        # Partial index ordered by id (UUIDv7 = time-ordered) so the poller can do
        # `WHERE processed_at IS NULL ORDER BY id ... FOR UPDATE SKIP LOCKED` index-ordered.
        Index(
            "ix_outbox_unprocessed",
            "id",
            postgresql_where=text("processed_at IS NULL"),
        ),
    )

    aggregate: Mapped[str] = mapped_column(Text, nullable=False)
    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    processed_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Retry bookkeeping for the in-process poller: bump on failure, dead-letter
    # (set processed_at + keep last_error) once attempts hits the max.
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)


class AuditLog(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_organization_id_created_at", "organization_id", "created_at"),
        Index("ix_audit_logs_entity_entity_id", "entity", "entity_id"),
    )

    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(Text, nullable=False)
    entity: Mapped[str] = mapped_column(Text, nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    before: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    after: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)


class IdempotencyKey(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    """Dedupes mutating requests (score retries on flaky wifi) — Postgres-backed at MVP."""

    __tablename__ = "idempotency_keys"
    __table_args__ = (UniqueConstraint("organization_id", "key"),)

    key: Mapped[str] = mapped_column(String(200), nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
    request_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    response_snapshot: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(
        IDEMPOTENCY_STATUS, nullable=False, server_default=text("'started'")
    )
    expires_at: Mapped[datetime.datetime] = mapped_column(nullable=False)


class FeatureFlag(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Global / org / user feature flags with percentage rollout.

    NO_RLS config table: `scope`+`scope_id` locate a flag (global → scope_id NULL,
    organization → org id, user → user id). Precedence user > org > global is applied
    by the evaluator, not the schema. `NULLS NOT DISTINCT` keeps one global row per key.
    """

    __tablename__ = "feature_flags"
    __table_args__ = (
        UniqueConstraint(
            "key",
            "scope",
            "scope_id",
            name="uq_feature_flags_key_scope",
            postgresql_nulls_not_distinct=True,
        ),
        Index("ix_feature_flags_key", "key"),
    )

    key: Mapped[str] = mapped_column(String(120), nullable=False)
    scope: Mapped[str] = mapped_column(FEATURE_FLAG_SCOPE, nullable=False)
    scope_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    rollout_percentage: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("100")
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
