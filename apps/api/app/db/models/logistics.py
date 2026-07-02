"""Logistics: Venue, Court, TournamentCourt, ScheduleSlot, Assignment."""

from __future__ import annotations

import datetime
import uuid

from sqlalchemy import ForeignKey, Index, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import ASSIGNMENT_ROLE, COURT_STATUS
from app.db.mixins import OrgScopedMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Venue(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    __tablename__ = "venues"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)

    courts: Mapped[list[Court]] = relationship(
        back_populates="venue", cascade="all, delete-orphan", passive_deletes=True
    )


class Court(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    __tablename__ = "courts"

    venue_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("venues.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    # Operational status — a "disabled" or "maintenance" court is skipped by scheduling
    # (assignment + conflict checks both read this), independent of tournament assignment.
    status: Mapped[str] = mapped_column(
        COURT_STATUS, nullable=False, server_default=text("'active'")
    )

    venue: Mapped[Venue] = relationship(back_populates="courts")


class TournamentCourt(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    """Explicit "this court may be used by this tournament" assignment — distinct from
    the finer-grained per-window availability already modeled by ``ScheduleSlot``. A
    court must be assigned here before a match in the tournament can be scheduled onto
    it."""

    __tablename__ = "tournament_courts"
    __table_args__ = (UniqueConstraint("tournament_id", "court_id"),)

    tournament_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tournaments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    court_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courts.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    court: Mapped[Court] = relationship()


class ScheduleSlot(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    """A court × time window, optionally bound to a match (enables conflict checks)."""

    __tablename__ = "schedule_slots"
    __table_args__ = (Index("ix_schedule_slots_court_id_starts_at", "court_id", "starts_at"),)

    tournament_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tournaments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    court_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courts.id", ondelete="RESTRICT"), nullable=False
    )
    starts_at: Mapped[datetime.datetime] = mapped_column(nullable=False)
    ends_at: Mapped[datetime.datetime] = mapped_column(nullable=False)
    match_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("matches.id", ondelete="SET NULL"), nullable=True
    )


class Assignment(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    """Scorekeeper/marshal assigned to a match or court."""

    __tablename__ = "assignments"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(ASSIGNMENT_ROLE, nullable=False)
    # Indexed for "who is assigned to this match/court" during live scoring.
    match_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), nullable=True, index=True
    )
    court_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courts.id", ondelete="RESTRICT"), nullable=True, index=True
    )
