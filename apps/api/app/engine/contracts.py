"""The competition-engine contracts — six ``Protocol``s every format/service plugs into.

Design rules for all engines:
- **Pure & deterministic.** No wall clock, no ambient randomness. Any randomness
  (e.g. ``SeedingMethod.RANDOM``) is driven by an explicit ``rng_seed`` on the request,
  so the same input always yields the same output — trivially unit-testable.
- **Framework-free.** Inputs/outputs are the value objects in ``types`` only.
- **Errors via the contracts in ``errors``** — ``EngineValidationError`` for bad
  config, ``ContractError`` for precondition violations, ``UnknownFormatError`` at the
  registry. Engines never raise HTTP/DB errors.

No business algorithms live here — only the shapes future formats implement.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable

from app.engine.advancement import AdvancementRule, parse_advancement
from app.engine.errors import EngineValidationError, Issue
from app.engine.source_refs import SourceRefs, parse_source_refs
from app.engine.types import (
    AdvancementResult,
    CourtWindow,
    FormatKey,
    GroupKey,
    MatchKey,
    MatchPlan,
    MatchResult,
    ParticipantId,
    ParticipantRef,
    PointsPolicy,
    SchedulePlan,
    SchedulingConstraints,
    StandingRow,
    StructurePlan,
    TiebreakPolicy,
)

# ---- request objects (immutable engine inputs) ----


@dataclass(frozen=True)
class GenerateRequest:
    """Build a stage's initial structure from seeded participants + parsed config."""

    format: FormatKey
    participants: tuple[ParticipantRef, ...]
    config: Mapping[str, Any] = field(default_factory=dict)
    rng_seed: int | None = None


@dataclass(frozen=True)
class PairingRequest:
    """Pair the next round for dynamic formats (swiss/ladder)."""

    participants: tuple[ParticipantRef, ...]
    standings: tuple[StandingRow, ...]
    played_pairs: frozenset[tuple[ParticipantId, ParticipantId]]
    round_seq: int
    config: Mapping[str, Any] = field(default_factory=dict)
    rng_seed: int | None = None


@dataclass(frozen=True)
class StandingsRequest:
    """Compute standings for one group/stage from completed match results."""

    participants: tuple[ParticipantRef, ...]
    results: tuple[MatchResult, ...]
    points: PointsPolicy
    tiebreak: TiebreakPolicy
    group_key: GroupKey | None = None


@dataclass(frozen=True)
class ScheduleRequest:
    """Place matches onto court windows under constraints."""

    matches: tuple[MatchPlan, ...]
    courts: tuple[CourtWindow, ...]
    constraints: SchedulingConstraints
    rng_seed: int | None = None


@dataclass(frozen=True)
class AdvancementRequest:
    """Resolve a bracket's pending sides from its seeds + completed match winners.

    ``matches`` is the bracket (each with ``source_refs``); ``seeds`` maps seed number
    → participant id; ``winners`` maps a completed match's key → its winner id (a normal
    result or a walkover). Byes are derived, not passed. Generic across elimination formats.
    """

    matches: tuple[MatchPlan, ...]
    seeds: Mapping[int, ParticipantId] = field(default_factory=dict)
    winners: Mapping[MatchKey, ParticipantId] = field(default_factory=dict)


# ---- engine protocols ----


@runtime_checkable
class FormatEngine(Protocol):
    """Turns seeded participants into a stage structure (groups/rounds/matches).

    Extension point: one implementation per ``FormatKey``, registered in the
    ``FormatRegistry``. Responsible for its own ``config`` validation.
    """

    key: FormatKey

    def validate_config(self, config: Mapping[str, Any]) -> None:
        """Raise ``EngineValidationError`` if this format's config is invalid."""
        ...

    def generate(self, request: GenerateRequest) -> StructurePlan: ...


@runtime_checkable
class PairingEngine(Protocol):
    """Produces the next round's matches for formats that pair dynamically."""

    def pair_round(self, request: PairingRequest) -> tuple[MatchPlan, ...]: ...


@runtime_checkable
class StandingsEngine(Protocol):
    """Computes an ordered, fully-ranked standings table (total order guaranteed
    by falling back to a stable key after the tiebreak policy is exhausted)."""

    def compute(self, request: StandingsRequest) -> tuple[StandingRow, ...]: ...


@runtime_checkable
class AdvancementEngine(Protocol):
    """Resolves a bracket forward: seeds + completed winners → each match's sides, the
    matches now playable, and byes auto-decided as walkovers. Rejects invalid winners.
    Generic across elimination formats (single/double elim, knockout stage)."""

    def resolve(self, request: AdvancementRequest) -> AdvancementResult: ...


@runtime_checkable
class SchedulingEngine(Protocol):
    """Assigns matches to court windows, honoring rest gaps + no double-booking."""

    def schedule(self, request: ScheduleRequest) -> SchedulePlan: ...


@runtime_checkable
class ValidationEngine(Protocol):
    """The single surface that validates engine-facing config/wiring."""

    def validate_source_refs(self, data: Any) -> SourceRefs: ...

    def validate_advancement(self, data: Any) -> AdvancementRule: ...

    def validate_wiring(self, source_refs_by_match: Mapping[MatchKey, SourceRefs]) -> None: ...


# ---- default ValidationEngine implementation ----


class SchemaValidator:
    """Default ``ValidationEngine`` — delegates to the finalized schema parsers and
    adds cross-match referential integrity for bracket wiring."""

    def validate_source_refs(self, data: Any) -> SourceRefs:
        return parse_source_refs(data)

    def validate_advancement(self, data: Any) -> AdvancementRule:
        return parse_advancement(data)

    def validate_wiring(self, source_refs_by_match: Mapping[MatchKey, SourceRefs]) -> None:
        """Every winner_of/loser_of reference must point to a known match, and a
        match may not reference itself. (Acyclicity of the full bracket DAG is the
        format generator's responsibility.)"""
        known = set(source_refs_by_match)
        issues: list[Issue] = []
        for match_key, refs in source_refs_by_match.items():
            for referenced in refs.referenced_matches():
                if referenced == match_key:
                    issues.append(
                        Issue(match_key, "self_reference", "a match cannot reference itself")
                    )
                elif referenced not in known:
                    issues.append(
                        Issue(
                            match_key,
                            "unknown_reference",
                            f"references unknown match {referenced!r}",
                        )
                    )
        if issues:
            raise EngineValidationError(issues)
