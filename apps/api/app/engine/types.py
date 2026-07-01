"""Shared domain value objects the engines speak in — pure, framework-free.

The engine never sees a DB row: it works with abstract ids (plain strings, so it's
decoupled from the DB's UUID type) and immutable, hashable value objects. It even
defines its **own** enum vocabulary (``FormatKey``, ``SideOutcome`` …) rather than
importing ``app.db.enums`` — that would pull SQLAlchemy in. The core translates
DB enums ↔ engine enums by value at the boundary (the string values match).
"""

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal

from app.engine.source_refs import SourceRefs

# Abstract id aliases — the engine is agnostic to the DB's UUID type.
ParticipantId = str
MatchKey = str
GroupKey = str
RoundKey = str
StageKey = str
CourtId = str


class FormatKey(str, enum.Enum):
    """Mirrors ``app.db.enums.StageFormat`` by value (translated at the boundary)."""

    ROUND_ROBIN = "round_robin"
    SINGLE_ELIM = "single_elim"
    GROUP_KNOCKOUT = "group_knockout"
    SWISS = "swiss"
    LADDER = "ladder"


class SeedingMethod(str, enum.Enum):
    CROSS = "cross"  # 1 vs last, cross-bracketed
    SNAKE = "snake"  # serpentine distribution across groups/slots
    AS_IS = "as_is"  # preserve incoming order
    RANDOM = "random"  # shuffled — requires an rng_seed for determinism


class SideOutcome(str, enum.Enum):
    """Per-side abstract outcome (mirrors ``app.db.enums.MatchOutcome``)."""

    WIN = "win"
    LOSS = "loss"
    DRAW = "draw"
    RANK = "rank"


class OutcomeKind(str, enum.Enum):
    """The shape of a contest result as the Sport Profile derives it."""

    WINNER = "winner"
    DRAW = "draw"
    RANKED = "ranked"


# ---- competitor + result value objects ----


@dataclass(frozen=True)
class ParticipantRef:
    """A competitor as the engine sees it — id + optional seeding inputs."""

    id: ParticipantId
    seed: int | None = None
    rating: Decimal | None = None
    skill: str | None = None


@dataclass(frozen=True)
class Outcome:
    """Abstract match result from the Sport Profile. Exactly one kind is populated."""

    kind: OutcomeKind
    winner_id: ParticipantId | None = None
    drawn_ids: tuple[ParticipantId, ...] = ()
    ranked_ids: tuple[ParticipantId, ...] = ()  # best → worst

    @classmethod
    def winner(cls, participant_id: ParticipantId) -> "Outcome":
        return cls(OutcomeKind.WINNER, winner_id=participant_id)

    @classmethod
    def draw(cls, participant_ids: tuple[ParticipantId, ...]) -> "Outcome":
        return cls(OutcomeKind.DRAW, drawn_ids=tuple(participant_ids))

    @classmethod
    def ranked(cls, participant_ids: tuple[ParticipantId, ...]) -> "Outcome":
        return cls(OutcomeKind.RANKED, ranked_ids=tuple(participant_ids))


@dataclass(frozen=True)
class SideResult:
    """One side's contribution to standings, from a completed match."""

    participant_id: ParticipantId
    outcome: SideOutcome
    score_for: int = 0
    score_against: int = 0
    rank: int | None = None  # for N-sided (ranked) contests


@dataclass(frozen=True)
class MatchResult:
    """A completed match reduced to its abstract per-side results."""

    match_key: MatchKey
    sides: tuple[SideResult, ...]
    group_key: GroupKey | None = None


# ---- scoring policies (from PointsRule / TiebreakRuleset) ----


@dataclass(frozen=True)
class PointsPolicy:
    win: Decimal
    draw: Decimal = Decimal(0)
    loss: Decimal = Decimal(0)
    walkover: Decimal = Decimal(0)


@dataclass(frozen=True)
class TiebreakPolicy:
    """Ordered criteria, e.g. ("match_points", "head_to_head", "score_diff")."""

    criteria: tuple[str, ...] = ()


@dataclass(frozen=True)
class StandingRow:
    """A computed standing (StandingsEngine output). ``diff`` is derived."""

    participant_id: ParticipantId
    group_key: GroupKey | None = None
    played: int = 0
    won: int = 0
    drawn: int = 0
    lost: int = 0
    points: Decimal = Decimal(0)
    score_for: int = 0
    score_against: int = 0
    rank: int | None = None
    qualified: bool = False

    @property
    def diff(self) -> int:
        return self.score_for - self.score_against


# ---- structure plans (FormatEngine / PairingEngine output) ----


@dataclass(frozen=True)
class MatchPlan:
    """A planned match. ``source_refs`` fully describes each side's origin."""

    key: MatchKey
    source_refs: SourceRefs
    round_key: RoundKey | None = None
    group_key: GroupKey | None = None


@dataclass(frozen=True)
class GroupPlan:
    key: GroupKey
    name: str
    participant_ids: tuple[ParticipantId, ...] = ()


@dataclass(frozen=True)
class RoundPlan:
    key: RoundKey
    seq: int
    label: str | None = None


@dataclass(frozen=True)
class StructurePlan:
    """The abstract structure the core persists as Stage/Group/Round/Match rows."""

    format: FormatKey
    groups: tuple[GroupPlan, ...] = ()
    rounds: tuple[RoundPlan, ...] = ()
    matches: tuple[MatchPlan, ...] = ()


# ---- scheduling value objects (SchedulingEngine) ----


@dataclass(frozen=True)
class CourtWindow:
    """A court's availability window (abstract court id + explicit times)."""

    court_id: CourtId
    starts_at: datetime
    ends_at: datetime


@dataclass(frozen=True)
class SchedulingConstraints:
    match_duration: timedelta
    rest_gap: timedelta = timedelta(0)
    max_concurrent_per_participant: int = 1  # 1 ⇒ no double-booking


@dataclass(frozen=True)
class SlotAssignment:
    match_key: MatchKey
    court_id: CourtId
    starts_at: datetime
    ends_at: datetime


@dataclass(frozen=True)
class SchedulePlan:
    assignments: tuple[SlotAssignment, ...] = ()
    unscheduled: tuple[MatchKey, ...] = ()  # could not be placed under constraints


# ---- advancement result (AdvancementEngine output) ----


@dataclass(frozen=True)
class QualifierSlot:
    """A destination seed slot filled by a qualifier from a source stage."""

    slot: int  # 1-based destination seed
    participant_id: ParticipantId
    source_group: GroupKey | None
    source_rank: int


@dataclass(frozen=True)
class AdvancementResult:
    ordered: tuple[ParticipantId, ...] = ()  # qualifiers in seeded order
    slots: tuple[QualifierSlot, ...] = field(default=())
