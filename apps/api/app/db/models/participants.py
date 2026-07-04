"""Participants: Team, RosterEntry, Participant (polymorphic), Registration, PairingRequest,
plus the Smart Pairing staging tables (PairingRun, ProposedTeam).

A Participant abstracts "who competes": an individual (a user), or a pair/team
(a Team row with roster entries). The CHECK keeps the polymorphism honest. All
tenant-strict; FKs to org-level users/teams are RESTRICT, division links CASCADE.
"""

from __future__ import annotations

import datetime
import decimal
import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import (
    ATTENDANCE_STATUS,
    PAIRING_RUN_STATUS,
    PARTICIPANT_KIND,
    PARTICIPANT_STATUS,
    REGISTRATION_STATUS,
    SKILL_LEVEL,
)
from app.db.mixins import OrgScopedMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.db.models.competition import MatchParticipant, Standing
    from app.db.models.squads import Squad
    from app.db.models.tournament import Division


class Team(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "teams"

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    captain_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )

    roster_entries: Mapped[list[RosterEntry]] = relationship(
        back_populates="team", cascade="all, delete-orphan", passive_deletes=True
    )


class RosterEntry(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    __tablename__ = "roster_entries"

    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
    external_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    role: Mapped[str | None] = mapped_column(String(40), nullable=True)

    team: Mapped[Team] = relationship(back_populates="roster_entries")


class Participant(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "participants"
    __table_args__ = (
        CheckConstraint(
            # user_id may be NULL for individually imported players (no platform account yet).
            "(kind = 'individual' AND team_id IS NULL AND squad_id IS NULL)"
            " OR (kind IN ('pair', 'team') AND team_id IS NOT NULL"
            " AND user_id IS NULL AND squad_id IS NULL)"
            " OR (kind = 'squad' AND squad_id IS NOT NULL"
            " AND user_id IS NULL AND team_id IS NULL)",
            name="participant_kind_refs",
        ),
        # No duplicate seeds within a division (when seeded).
        Index(
            "uq_participants_division_id_seed",
            "division_id",
            "seed",
            unique=True,
            postgresql_where=text("seed IS NOT NULL"),
        ),
    )

    division_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("divisions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind: Mapped[str] = mapped_column(PARTICIPANT_KIND, nullable=False)
    # Indexed: "my participations" (portal) and team->participant lookups at scale.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    team_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    squad_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("squads.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    seed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rating: Mapped[decimal.Decimal | None] = mapped_column(Numeric(8, 3), nullable=True)
    skill_level: Mapped[str | None] = mapped_column(SKILL_LEVEL, nullable=True)
    status: Mapped[str] = mapped_column(
        PARTICIPANT_STATUS, nullable=False, server_default=text("'registered'")
    )
    # Event-day attendance — independent of the registration-lifecycle ``status`` above.
    attendance: Mapped[str] = mapped_column(
        ATTENDANCE_STATUS, nullable=False, server_default=text("'pending'")
    )
    checked_in_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    division: Mapped[Division] = relationship(back_populates="participants")
    squad: Mapped[Squad | None] = relationship(viewonly=True)
    match_links: Mapped[list[MatchParticipant]] = relationship(
        back_populates="participant", cascade="all, delete-orphan", passive_deletes=True
    )
    standings: Mapped[list[Standing]] = relationship(
        back_populates="participant", cascade="all, delete-orphan", passive_deletes=True
    )


class Registration(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    __tablename__ = "registrations"

    division_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("divisions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    submitted_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    form_response: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    status: Mapped[str] = mapped_column(
        REGISTRATION_STATUS, nullable=False, server_default=text("'submitted'")
    )
    skill_level: Mapped[str | None] = mapped_column(SKILL_LEVEL, nullable=True)
    # Set when the registration is approved into a Participant.
    participant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("participants.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
    )

    division: Mapped[Division] = relationship(back_populates="registrations")


class PairingRequest(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    """Solo doubles entrant awaiting skill-weighted auto-pairing."""

    __tablename__ = "pairing_requests"

    division_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("divisions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    skill_weight: Mapped[decimal.Decimal] = mapped_column(Numeric(8, 3), nullable=False)
    preferred_partner_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class PairingRun(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    """One Smart-Pairing generation for a division — a reviewable draft batch.

    The engine's proposed teams live here (as ``ProposedTeam`` rows) until the organizer
    publishes them, at which point they materialize into real ``Team`` + pair
    ``Participant`` rows. Kept separate so drafts never pollute the live participant pool
    (draws/standings). ``config`` snapshots the policy + constraints used; ``rng_seed``
    makes a run reproducible.
    """

    __tablename__ = "pairing_runs"

    division_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("divisions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        PAIRING_RUN_STATUS, nullable=False, server_default=text("'draft'")
    )
    rng_seed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    config: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )

    proposed_teams: Mapped[list[ProposedTeam]] = relationship(
        back_populates="run", cascade="all, delete-orphan", passive_deletes=True
    )


class ProposedTeam(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    """A team the pairing engine proposed within a run. ``member_ids`` are the source
    registration ids (the solo entrants); ``locked`` pins an organizer-edited team so a
    regenerate leaves it intact. Ephemeral until its run is published."""

    __tablename__ = "proposed_teams"

    pairing_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pairing_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    member_ids: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    strength: Mapped[decimal.Decimal] = mapped_column(Numeric(8, 3), nullable=False)
    confidence: Mapped[decimal.Decimal] = mapped_column(Numeric(4, 3), nullable=False)
    reasons: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    locked: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    team_name: Mapped[str | None] = mapped_column(String(160), nullable=True)

    run: Mapped[PairingRun] = relationship(back_populates="proposed_teams")
