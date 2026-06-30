"""Sport abstraction tables (global-or-tenant): pluggable Sport Profiles + rules.

These carry a NULLABLE organization_id: rows with org_id IS NULL are the global
seeded catalog (readable by every tenant); org-owned rows are private overrides.
RLS uses the NULL-carve-out policy (see app/db/rls.py). No sport-specific columns —
sport variance lives in the JSONB `result_schema` / `win_rules` / `criteria`.
"""

from __future__ import annotations

import decimal
import uuid
from typing import Any

from sqlalchemy import ForeignKey, Index, Numeric, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.enums import PARTICIPANT_KIND
from app.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class SportProfile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "sport_profiles"
    __table_args__ = (
        UniqueConstraint("organization_id", "key"),  # per-org key uniqueness
        # Global catalog: one row per key when org_id IS NULL.
        Index(
            "uq_sport_profiles_global_key",
            "key",
            unique=True,
            postgresql_where=text("organization_id IS NULL"),
        ),
    )

    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    key: Mapped[str] = mapped_column(String(60), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    participant_type: Mapped[str] = mapped_column(PARTICIPANT_KIND, nullable=False)
    result_schema: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    win_rules: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    default_tiebreak_ruleset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tiebreak_rulesets.id", ondelete="RESTRICT"), nullable=True
    )
    defaults: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )


class PointsRule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "points_rules"

    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    win_pts: Mapped[decimal.Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    draw_pts: Mapped[decimal.Decimal] = mapped_column(
        Numeric(6, 2), nullable=False, server_default=text("0")
    )
    loss_pts: Mapped[decimal.Decimal] = mapped_column(
        Numeric(6, 2), nullable=False, server_default=text("0")
    )
    walkover_pts: Mapped[decimal.Decimal] = mapped_column(
        Numeric(6, 2), nullable=False, server_default=text("0")
    )


class TiebreakRuleset(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tiebreak_rulesets"

    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    # Ordered list of criteria, e.g. ["match_points", "head_to_head", "score_diff"].
    criteria: Mapped[list[Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
