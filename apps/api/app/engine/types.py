"""Shared domain value objects the engines speak in — pure, framework-free.

The engine never sees a DB row: it works with abstract ids (plain strings, so it's
decoupled from the DB's UUID type) and immutable, hashable value objects. It even
defines its **own** enum vocabulary (``FormatKey``, ``SideOutcome`` …) rather than
importing ``app.db.enums`` — that would pull SQLAlchemy in. The core translates
DB enums ↔ engine enums by value at the boundary (the string values match).
"""

from __future__ import annotations

import enum
from collections.abc import Mapping
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


class ParticipantKind(str, enum.Enum):
    """Competitor shape (mirrors ``app.db.enums.ParticipantKind``). A Sport Profile
    declares which kinds it supports — e.g. badminton singles = individual, doubles = pair."""

    INDIVIDUAL = "individual"
    PAIR = "pair"
    TEAM = "team"


class TerminalReason(str, enum.Enum):
    """How a match reached a terminal state — lets standings treat a walkover/retirement
    differently from a normal result (e.g. apply walkover points)."""

    NORMAL = "normal"
    WALKOVER = "walkover"
    RETIREMENT = "retirement"
    NO_SHOW = "no_show"


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
    score_for: int = 0  # primary score dimension (e.g. games won in badminton)
    score_against: int = 0
    rank: int | None = None  # for N-sided (ranked) contests
    # Extra sport-defined per-side dimensions the standings engine accumulates
    # (e.g. {"points_for": 42, "points_against": 25}). Keeps the engine sport-blind.
    metrics: Mapping[str, int] = field(default_factory=dict)


@dataclass(frozen=True)
class MatchResult:
    """A completed match reduced to its abstract per-side results."""

    match_key: MatchKey
    sides: tuple[SideResult, ...]
    group_key: GroupKey | None = None
    terminal_reason: TerminalReason = TerminalReason.NORMAL


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
    # Accumulated sport-defined dimensions (e.g. points_for/points_against) for
    # finer tie-breaks + display. The primary dimension stays in score_for/against.
    metrics: Mapping[str, int] = field(default_factory=dict)

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


# ---- team formation (TeamFormationEngine input/output) ----
#
# A distinct concept from opponent pairing (``PairingEngine.pair_round``, which pairs
# who-plays-whom in a dynamic round). Team formation is a *pre-draw* step: combine solo
# entrants into balanced teams (e.g. doubles pairs) that then enter the draw as
# ``ParticipantKind.PAIR``/``TEAM`` competitors. Sport-agnostic: the engine pairs purely
# by numeric ``weight`` — the Sport Profile maps its skill vocabulary to those numbers
# and supplies the ``PairingPolicy`` (see ``SportProfile.pairing_policy``).

EntrantId = str  # a solo entrant awaiting team formation (a registration/user id at the boundary)


class PairingStrategy(str, enum.Enum):
    """How the engine aggregates entrant weights into teams."""

    BALANCE = "balance"  # fold pairing: drive every team toward ``target_strength``


@dataclass(frozen=True)
class PairingPolicy:
    """The sport-supplied numeric rules the engine forms teams by — never skill *labels*.

    ``target_strength`` is the ideal per-team aggregate weight (e.g. badminton doubles:
    2 + midpoint of 1..3 = 4). ``None`` means "no target" (the engine just fills teams).
    """

    team_size: int = 2
    target_strength: Decimal | None = None
    strategy: PairingStrategy = PairingStrategy.BALANCE

    @property
    def supports_pairing(self) -> bool:
        return self.team_size >= 2


@dataclass(frozen=True)
class PairingEntrant:
    """A solo competitor awaiting team formation, with its resolved numeric weight."""

    id: EntrantId
    weight: Decimal = Decimal(0)  # resolved skill weight — the Sport Profile maps skill→weight
    display_name: str = ""
    preferred_partner_id: EntrantId | None = None  # soft: honored when mutual + feasible


@dataclass(frozen=True)
class PairingConstraints:
    """Constraints on team formation. ``forced_groups`` are hard manual overrides (each
    inner group must become exactly one team); ``forbidden_pairs`` may never share a team;
    ``prior_pairings`` are partnerships from earlier rounds the engine avoids repeating
    when ``avoid_repeats`` is set (best-effort — repeats are allowed if unavoidable)."""

    forced_groups: tuple[tuple[EntrantId, ...], ...] = ()
    forbidden_pairs: tuple[tuple[EntrantId, EntrantId], ...] = ()
    prior_pairings: tuple[tuple[EntrantId, EntrantId], ...] = ()
    avoid_repeats: bool = True


@dataclass(frozen=True)
class TeamProposal:
    """A team the engine formed. ``confidence`` is 0..1 (how close to the target strength
    plus honored preferences); ``reasons`` explains the decision for the organizer UI."""

    key: str  # stable within the plan (e.g. "T1")
    member_ids: tuple[EntrantId, ...]
    strength: Decimal
    confidence: Decimal
    reasons: tuple[str, ...] = ()
    forced: bool = False  # formed from a hard override / honored preference, not the balancer


@dataclass(frozen=True)
class TeamFormationPlan:
    """The engine's proposed teams plus any odd-one-out entrants that couldn't be placed."""

    teams: tuple[TeamProposal, ...] = ()
    unpaired: tuple[EntrantId, ...] = ()
    rng_seed: int | None = None  # echoes the seed used, for reproducibility display


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


# ---- bracket resolution (AdvancementEngine output) ----


@dataclass(frozen=True)
class ResolvedSide:
    """A bracket side after resolution: a known participant, a bye, or still pending
    (its feeding match hasn't completed yet)."""

    participant_id: ParticipantId | None = None
    is_bye: bool = False

    @property
    def is_pending(self) -> bool:
        return self.participant_id is None and not self.is_bye


@dataclass(frozen=True)
class AdvancementResult:
    """The resolved state of a bracket: per-match sides + derived progression."""

    sides: Mapping[MatchKey, tuple[ResolvedSide, ...]] = field(default_factory=dict)
    winners: Mapping[MatchKey, ParticipantId] = field(default_factory=dict)  # incl. bye walkovers
    ready: frozenset[MatchKey] = frozenset()  # all sides known ⇒ playable
    byes: frozenset[MatchKey] = frozenset()  # auto-decided by a bye (walkover)
