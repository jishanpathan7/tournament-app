"""The Sport Profile contract — the generic seam every sport implements.

Kept in the engine layer because it's the abstraction the domain core depends on
(alongside ``FormatEngine``), but it stays completely sport-blind: it only speaks in
the engine's value objects (``Outcome``/``SideResult``/``ParticipantKind`` …). Every
sport-specific rule lives in the concrete profile (``app/sports/*``), never here.

A profile turns an opaque ``result_payload`` (validated against its own rules) into
abstract, engine-consumable results via ``derive_result`` → ``MatchReport``. The core
persists the per-side ``SideResult``s (→ match_participants) and the ``statistics``,
and hands the abstract outcome to the standings/advancement engines.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Protocol, runtime_checkable

from app.engine.types import (
    FormatKey,
    Outcome,
    PairingPolicy,
    ParticipantId,
    ParticipantKind,
    SideResult,
    TerminalReason,
)


@dataclass(frozen=True)
class MatchMetadata:
    """Descriptive (not rule) info about a match under a given config."""

    scoring_unit: str  # e.g. "points"
    sides: int = 2  # competitors per match (2 = versus)
    estimated_minutes: int | None = None


@dataclass(frozen=True)
class MatchReport:
    """A profile's reduction of a terminal match to abstract results + statistics.

    ``sides`` are the per-competitor outcomes/scores (→ standings); ``statistics`` is
    sport-specific per-participant detail (games won, points, …) for display and finer
    tie-breaks; ``terminal_reason`` distinguishes normal/walkover/retirement/no-show.
    """

    outcome: Outcome
    sides: tuple[SideResult, ...]
    terminal_reason: TerminalReason = TerminalReason.NORMAL
    statistics: Mapping[ParticipantId, Mapping[str, int]] = field(default_factory=dict)


@runtime_checkable
class SportProfile(Protocol):
    """Everything the core needs to run a sport, without knowing the sport."""

    key: str

    # --- capabilities ---
    def supported_participant_kinds(self) -> frozenset[ParticipantKind]: ...

    def supported_formats(self) -> frozenset[FormatKey]: ...

    def tiebreak_criteria(self) -> tuple[str, ...]: ...

    # --- configuration ---
    def default_config(self) -> Mapping[str, Any]: ...

    def validate_config(self, config: Mapping[str, Any]) -> None:
        """Raise ``EngineValidationError`` if the match config is invalid."""
        ...

    def match_metadata(self, config: Mapping[str, Any]) -> MatchMetadata: ...

    # --- participants ---
    def validate_participants(
        self, kind: ParticipantKind, side_rosters: Sequence[Sequence[ParticipantId]]
    ) -> None:
        """Validate competitor shape (kind + roster sizes) for singles/doubles/teams."""
        ...

    # --- team formation (pairing) ---
    def pairing_policy(self, config: Mapping[str, Any]) -> PairingPolicy:
        """The team-formation rules for this sport — team size, target aggregate strength,
        and strategy. Return ``PairingPolicy(team_size=1)`` (``supports_pairing`` is False)
        for singles-only sports that never combine entrants into teams."""
        ...

    def skill_weight(self, skill: str | None) -> Decimal:
        """Map a skill label (or ``None``) to the numeric weight the pairing engine
        balances teams by. Sports with no skill tiers may return a constant."""
        ...

    # --- results ---
    def validate_result(self, payload: Mapping[str, Any], config: Mapping[str, Any]) -> None:
        """Raise ``EngineValidationError`` for malformed/illegal scores."""
        ...

    def derive_result(
        self,
        payload: Mapping[str, Any],
        config: Mapping[str, Any],
        *,
        side_participant_ids: Sequence[ParticipantId],
    ) -> MatchReport:
        """Reduce a validated payload to abstract results + statistics."""
        ...
