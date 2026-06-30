"""Participants: Team, RosterEntry, Participant (polymorphic), Registration, PairingRequest.

A Participant abstracts "who competes": an individual (a user), or a pair/team
(a Team row with roster entries). The CHECK keeps the polymorphism honest. All
tenant-strict; FKs to org-level users/teams are RESTRICT, division links CASCADE.
"""

from __future__ import annotations

import decimal
import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, Numeric, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import PARTICIPANT_KIND, PARTICIPANT_STATUS, REGISTRATION_STATUS, SKILL_LEVEL
from app.db.mixins import OrgScopedMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.db.models.competition import MatchParticipant, Standing
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
            "(kind = 'individual' AND user_id IS NOT NULL AND team_id IS NULL) "
            "OR (kind IN ('pair', 'team') AND team_id IS NOT NULL AND user_id IS NULL)",
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
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    seed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rating: Mapped[decimal.Decimal | None] = mapped_column(Numeric(8, 3), nullable=True)
    skill_level: Mapped[str | None] = mapped_column(SKILL_LEVEL, nullable=True)
    status: Mapped[str] = mapped_column(
        PARTICIPANT_STATUS, nullable=False, server_default=text("'registered'")
    )

    division: Mapped[Division] = relationship(back_populates="participants")
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
