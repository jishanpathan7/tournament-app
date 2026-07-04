"""Competition: Match, MatchParticipant (N-sided), MatchResultEvent, Standing.

The sport-agnostic core. A Match holds a generic `result_payload` (JSONB) the
engine never reads; the abstract outcome lives per-side on `match_participants`
(`outcome`/`is_winner`/`rank`/`score`). This supports 2-sided versus AND N-sided
contests (Swiss, judged rounds) without any sport-specific column. Standings are
derived/materialized — never hand-edited.
"""

from __future__ import annotations

import datetime
import decimal
import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    Boolean,
    Computed,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import (
    CONTEST_KIND,
    MATCH_OUTCOME,
    MATCH_STATUS,
)
from app.db.mixins import OrgScopedMixin, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.db.models.participants import Participant
    from app.db.models.tournament import Group, Round, Stage


class Match(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    __tablename__ = "matches"
    __table_args__ = (
        Index("ix_matches_tournament_id_status", "tournament_id", "status"),
        Index("ix_matches_stage_id_round_id", "stage_id", "round_id"),
        Index("ix_matches_court_id_scheduled_at", "court_id", "scheduled_at"),
    )

    # Denormalized for cheap tenant/public scoping (avoids match->stage->division->tournament).
    tournament_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False
    )
    stage_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stages.id", ondelete="CASCADE"), nullable=False
    )
    round_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rounds.id", ondelete="SET NULL"), nullable=True
    )
    group_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("groups.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        MATCH_STATUS, nullable=False, server_default=text("'scheduled'")
    )
    scheduled_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    court_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courts.id", ondelete="RESTRICT"), nullable=True
    )
    # Estimate used to compute the match's occupied window for conflict detection + the
    # schedule timeline; null until a duration is assigned (defaults applied by the
    # scheduling service, not the column).
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    contest_kind: Mapped[str] = mapped_column(
        CONTEST_KIND, nullable=False, server_default=text("'standard'")
    )
    parent_match_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("matches.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    result_payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    # Bracket wiring (winner-of/loser-of) — engine logic, opaque to the core.
    source_refs: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )

    stage: Mapped[Stage] = relationship(back_populates="matches")
    # Read-only: Round/Group carry the human label ("Quarterfinal", "Pool A") the engine
    # already computes at draw time — surfaced to the API via these, never written here.
    round: Mapped[Round | None] = relationship(viewonly=True)
    group: Mapped[Group | None] = relationship(viewonly=True)
    participants: Mapped[list[MatchParticipant]] = relationship(
        back_populates="match", cascade="all, delete-orphan", passive_deletes=True
    )
    result_events: Mapped[list[MatchResultEvent]] = relationship(
        back_populates="match", cascade="all, delete-orphan", passive_deletes=True
    )
    parent_match: Mapped[Match | None] = relationship(
        remote_side="Match.id", foreign_keys=[parent_match_id], viewonly=True
    )
    leg_matches: Mapped[list[Match]] = relationship(
        "Match",
        foreign_keys="Match.parent_match_id",
        viewonly=True,
    )


class MatchParticipant(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    """One side of a match. Winner ∈ participants is structural; draw = no is_winner."""

    __tablename__ = "match_participants"
    __table_args__ = (
        UniqueConstraint("match_id", "participant_id"),
        Index("ix_match_participants_participant_id", "participant_id"),
    )

    match_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    participant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("participants.id", ondelete="CASCADE"), nullable=False
    )
    seed_in_match: Mapped[int | None] = mapped_column(Integer, nullable=True)
    outcome: Mapped[str | None] = mapped_column(MATCH_OUTCOME, nullable=True)
    # Derived from outcome so it can never drift; the engine reads the abstract outcome.
    is_winner: Mapped[bool] = mapped_column(
        Boolean, Computed("(COALESCE(outcome = 'win', false))", persisted=True), nullable=False
    )
    rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score: Mapped[decimal.Decimal | None] = mapped_column(Numeric(10, 3), nullable=True)

    match: Mapped[Match] = relationship(back_populates="participants")
    participant: Mapped[Participant] = relationship(back_populates="match_links")


class MatchResultEvent(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    """Append-only scoring/correction log for a match (audit trail)."""

    __tablename__ = "match_result_events"
    __table_args__ = (
        Index("ix_match_result_events_match_id_created_at", "match_id", "created_at"),
    )

    match_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    type: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )

    match: Mapped[Match] = relationship(back_populates="result_events")


class Standing(UUIDPrimaryKeyMixin, OrgScopedMixin, TimestampMixin, Base):
    """Derived standing row (one per participant per group/stage)."""

    __tablename__ = "standings"
    __table_args__ = (
        UniqueConstraint(
            "stage_id", "group_id", "participant_id", postgresql_nulls_not_distinct=True
        ),
        Index("ix_standings_stage_id_group_id_rank", "stage_id", "group_id", "rank"),
    )

    stage_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stages.id", ondelete="CASCADE"), nullable=False, index=True
    )
    group_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("groups.id", ondelete="CASCADE"), nullable=True
    )
    participant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("participants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    played: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    won: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    drawn: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    lost: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    points: Mapped[decimal.Decimal] = mapped_column(
        Numeric(8, 2), nullable=False, server_default=text("0")
    )
    score_for: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    score_against: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    diff: Mapped[int] = mapped_column(
        Integer, Computed("(score_for - score_against)", persisted=True), nullable=False
    )
    rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    qualified: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    computed_at: Mapped[datetime.datetime | None] = mapped_column(nullable=True)

    stage: Mapped[Stage] = relationship(back_populates="standings")
    participant: Mapped[Participant] = relationship(back_populates="standings")
