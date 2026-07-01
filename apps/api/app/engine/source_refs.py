"""The finalized ``source_refs`` schema + its validator (decision #1).

A match's ``source_refs`` describes where **each side** comes from, so a bracket
match can exist before its participants are known. One side is exactly one of:

    {"seed": 3}                 # the entrant seeded #3 in this stage's seeding
    {"participant": "<id>"}     # a concrete, already-known participant
    {"winner_of": "<match>"}    # winner of another match (by its plan key / id)
    {"loser_of": "<match>"}     # loser of another match (consolation / double-elim)
    {"bye": true}               # a bye — the opposing side auto-advances

Persisted shape (on ``matches.source_refs``):

    {"sides": [ <side>, <side>, ... ]}   # >= 1 side (N-sided supported)

At draw time the core resolves ``seed``/``participant`` sides into MatchParticipant
rows; ``winner_of``/``loser_of`` resolve on advancement; ``bye`` resolves to a
walkover. Validation lives **here** (not scattered) so every producer/consumer
agrees on one schema. Referential checks across matches live in
``ValidationEngine.validate_wiring`` (see contracts).
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from app.engine.errors import EngineValidationError, Issue


@dataclass(frozen=True)
class SeedRef:
    seed: int


@dataclass(frozen=True)
class ParticipantSideRef:
    participant_id: str


@dataclass(frozen=True)
class WinnerOfRef:
    match_key: str


@dataclass(frozen=True)
class LoserOfRef:
    match_key: str


@dataclass(frozen=True)
class ByeRef:
    pass


SideRef = SeedRef | ParticipantSideRef | WinnerOfRef | LoserOfRef | ByeRef

_SIDE_KEYS = ("seed", "participant", "winner_of", "loser_of", "bye")


@dataclass(frozen=True)
class SourceRefs:
    """The origin of every side of one match."""

    sides: tuple[SideRef, ...]

    def referenced_matches(self) -> frozenset[str]:
        """Match keys this match depends on (winner_of / loser_of) — for wiring checks."""
        refs = {s.match_key for s in self.sides if isinstance(s, (WinnerOfRef, LoserOfRef))}
        return frozenset(refs)


def _is_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _parse_side(raw: Any, path: str, issues: list[Issue]) -> SideRef | None:
    if not isinstance(raw, Mapping):
        issues.append(Issue(path, "invalid_type", "side must be an object"))
        return None
    present = [k for k in _SIDE_KEYS if k in raw]
    if len(present) != 1:
        issues.append(Issue(path, "one_of", f"a side must have exactly one of {list(_SIDE_KEYS)}"))
        return None
    key = present[0]
    value = raw[key]
    if key == "seed":
        if not _is_int(value) or value <= 0:
            issues.append(Issue(f"{path}.seed", "invalid", "seed must be a positive integer"))
            return None
        return SeedRef(int(value))
    if key == "participant":
        if not isinstance(value, str) or not value:
            issues.append(
                Issue(f"{path}.participant", "invalid", "participant must be a non-empty string")
            )
            return None
        return ParticipantSideRef(value)
    if key in ("winner_of", "loser_of"):
        if not isinstance(value, str) or not value:
            issues.append(
                Issue(f"{path}.{key}", "invalid", f"{key} must be a non-empty match reference")
            )
            return None
        return WinnerOfRef(value) if key == "winner_of" else LoserOfRef(value)
    # bye
    if value is not True:
        issues.append(Issue(f"{path}.bye", "invalid", "bye must be true"))
        return None
    return ByeRef()


def parse_source_refs(data: Any) -> SourceRefs:
    """Validate + parse a ``source_refs`` object. Raises ``EngineValidationError``."""
    if not isinstance(data, Mapping):
        raise EngineValidationError([Issue("", "invalid_type", "source_refs must be an object")])
    raw_sides = data.get("sides")
    if (
        not isinstance(raw_sides, Sequence)
        or isinstance(raw_sides, (str, bytes))
        or len(raw_sides) == 0
    ):
        raise EngineValidationError([Issue("sides", "required", "sides must be a non-empty array")])

    issues: list[Issue] = []
    sides: list[SideRef] = []
    for index, raw in enumerate(raw_sides):
        side = _parse_side(raw, f"sides[{index}]", issues)
        if side is not None:
            sides.append(side)
    if issues:
        raise EngineValidationError(issues)
    return SourceRefs(tuple(sides))
