"""Tournament structure: Tournament -> Division -> Stage -> Group / Round.

All tenant-strict (NOT NULL organization_id, RLS-managed). FKs cascade DOWN the
subtree so deleting a tournament tears down its tree; references to org-level
catalog (sport_profile, points_rule, tiebreak_ruleset) are RESTRICT.
"""

from __future__ import annotations

import datetime
import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import PARTICIPANT_KIND, STAGE_FORMAT, TOURNAMENT_STATUS, VISIBILITY
from app.db.mixins import OrgScopedMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.db.models.competition import Match, Standing
    from app.db.models.identity import Organization
    from app.db.models.logistics import Venue
    from app.db.models.participants import Participant, Registration
    from app.db.models.squads import Squad


class Tournament(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "tournaments"
    __table_args__ = (
        # Partial so the slug is freed when a tournament is soft-deleted.
        Index(
            "uq_tournaments_organization_id_slug",
            "organization_id",
            "slug",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("ix_tournaments_organization_id_status", "organization_id", "status"),
    )

    sport_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sport_profiles.id", ondelete="RESTRICT"), nullable=False
    )
    slug: Mapped[str] = mapped_column(String(140), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(
        TOURNAMENT_STATUS, nullable=False, server_default=text("'draft'")
    )
    visibility: Mapped[str] = mapped_column(
        VISIBILITY, nullable=False, server_default=text("'private'")
    )
    starts_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    ends_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    settings: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    venue_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("venues.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Per-artifact publication gates for the public plane.
    draw_published_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    schedule_published_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    results_published_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    organization: Mapped[Organization] = relationship(back_populates="tournaments")
    venue: Mapped[Venue | None] = relationship(foreign_keys=[venue_id], lazy="selectin")
    divisions: Mapped[list[Division]] = relationship(
        back_populates="tournament", cascade="all, delete-orphan", passive_deletes=True
    )
    squads: Mapped[list[Squad]] = relationship(
        back_populates="tournament", cascade="all, delete-orphan", passive_deletes=True
    )


class Division(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "divisions"

    tournament_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tournaments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    participant_type: Mapped[str] = mapped_column(PARTICIPANT_KIND, nullable=False)
    reg_form: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)

    tournament: Mapped[Tournament] = relationship(back_populates="divisions")
    stages: Mapped[list[Stage]] = relationship(
        back_populates="division", cascade="all, delete-orphan", passive_deletes=True
    )
    participants: Mapped[list[Participant]] = relationship(
        back_populates="division", cascade="all, delete-orphan", passive_deletes=True
    )
    registrations: Mapped[list[Registration]] = relationship(
        back_populates="division", cascade="all, delete-orphan", passive_deletes=True
    )


class Stage(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    __tablename__ = "stages"

    division_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("divisions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type: Mapped[str] = mapped_column(STAGE_FORMAT, nullable=False)
    seq: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    config: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    points_rule_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("points_rules.id", ondelete="RESTRICT"), nullable=True
    )
    tiebreak_ruleset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tiebreak_rulesets.id", ondelete="RESTRICT"), nullable=True
    )
    advances_n: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Linear single-source advancement for MVP (plate/consolation deferred).
    source_stage_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stages.id", ondelete="SET NULL"), nullable=True
    )

    division: Mapped[Division] = relationship(back_populates="stages")
    groups: Mapped[list[Group]] = relationship(
        back_populates="stage", cascade="all, delete-orphan", passive_deletes=True
    )
    rounds: Mapped[list[Round]] = relationship(
        back_populates="stage", cascade="all, delete-orphan", passive_deletes=True
    )
    matches: Mapped[list[Match]] = relationship(
        back_populates="stage", cascade="all, delete-orphan", passive_deletes=True
    )
    standings: Mapped[list[Standing]] = relationship(
        back_populates="stage", cascade="all, delete-orphan", passive_deletes=True
    )


class Group(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    __tablename__ = "groups"

    stage_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stages.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)

    stage: Mapped[Stage] = relationship(back_populates="groups")


class Round(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    __tablename__ = "rounds"

    stage_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stages.id", ondelete="CASCADE"), nullable=False, index=True
    )
    seq: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    label: Mapped[str | None] = mapped_column(String(40), nullable=True)

    stage: Mapped[Stage] = relationship(back_populates="rounds")
