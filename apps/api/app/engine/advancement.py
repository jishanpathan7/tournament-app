"""The finalized ``Stage.config.advancement`` schema + its validator (decision #2).

Declares how a stage is fed from prior stages' standings, so any bracket topology
(group→KO cross-seeding, plate/consolation, best-N-across-groups) is config, not code:

    {
      "sources": [
        {"stage": "<stage>", "groups": "all" | ["A","B"], "take": {"by": "rank", "range": [1, 2]}}
      ],
      "seeding": "cross" | "snake" | "as_is" | "random",
      "rngSeed": 42          # required when seeding == "random" (determinism)
    }

Validated **here** so the rule shape is defined in exactly one place.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from app.engine.errors import EngineValidationError, Issue
from app.engine.types import SeedingMethod

_TAKE_BYS = ("rank",)  # extensible (e.g. "points_threshold") without a schema change


@dataclass(frozen=True)
class TakeSpec:
    by: str  # currently "rank"
    lo: int  # inclusive, 1-based
    hi: int  # inclusive


@dataclass(frozen=True)
class AdvancementSource:
    stage: str
    groups: tuple[str, ...] | None  # None ⇒ all groups in the source stage
    take: TakeSpec


@dataclass(frozen=True)
class AdvancementRule:
    sources: tuple[AdvancementSource, ...]
    seeding: SeedingMethod
    rng_seed: int | None = None


def _is_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _parse_source(raw: Any, path: str, issues: list[Issue]) -> AdvancementSource | None:
    if not isinstance(raw, Mapping):
        issues.append(Issue(path, "invalid_type", "source must be an object"))
        return None

    stage = raw.get("stage")
    if not isinstance(stage, str) or not stage:
        issues.append(Issue(f"{path}.stage", "invalid", "stage must be a non-empty string"))

    groups_raw = raw.get("groups", "all")
    groups: tuple[str, ...] | None
    if groups_raw == "all":
        groups = None
    elif (
        isinstance(groups_raw, Sequence)
        and not isinstance(groups_raw, (str, bytes))
        and all(isinstance(g, str) and g for g in groups_raw)
        and len(groups_raw) > 0
    ):
        groups = tuple(groups_raw)
    else:
        issues.append(
            Issue(f"{path}.groups", "invalid", "groups must be 'all' or a non-empty string array")
        )
        groups = None

    take = _parse_take(raw.get("take"), f"{path}.take", issues)
    if issues or not isinstance(stage, str) or take is None:
        return None
    return AdvancementSource(stage=stage, groups=groups, take=take)


def _parse_take(raw: Any, path: str, issues: list[Issue]) -> TakeSpec | None:
    if not isinstance(raw, Mapping):
        issues.append(Issue(path, "required", "take must be an object"))
        return None
    by = raw.get("by")
    if by not in _TAKE_BYS:
        issues.append(Issue(f"{path}.by", "invalid", f"by must be one of {list(_TAKE_BYS)}"))
    rng = raw.get("range")
    if (
        not isinstance(rng, Sequence)
        or isinstance(rng, (str, bytes))
        or len(rng) != 2
        or not all(_is_int(x) for x in rng)
    ):
        issues.append(Issue(f"{path}.range", "invalid", "range must be [lo, hi] integers"))
        return None
    lo, hi = int(rng[0]), int(rng[1])
    if not (1 <= lo <= hi):
        issues.append(Issue(f"{path}.range", "invalid", "range must satisfy 1 <= lo <= hi"))
        return None
    if by not in _TAKE_BYS:
        return None
    return TakeSpec(by=str(by), lo=lo, hi=hi)


def parse_advancement(data: Any) -> AdvancementRule:
    """Validate + parse an ``advancement`` object. Raises ``EngineValidationError``."""
    if not isinstance(data, Mapping):
        raise EngineValidationError([Issue("", "invalid_type", "advancement must be an object")])

    issues: list[Issue] = []
    raw_sources = data.get("sources")
    sources: list[AdvancementSource] = []
    if (
        not isinstance(raw_sources, Sequence)
        or isinstance(raw_sources, (str, bytes))
        or len(raw_sources) == 0
    ):
        issues.append(Issue("sources", "required", "sources must be a non-empty array"))
    else:
        for index, raw in enumerate(raw_sources):
            source = _parse_source(raw, f"sources[{index}]", issues)
            if source is not None:
                sources.append(source)

    seeding_raw = data.get("seeding")
    seeding: SeedingMethod | None = None
    try:
        seeding = SeedingMethod(seeding_raw)
    except ValueError:
        issues.append(
            Issue(
                "seeding", "invalid", f"seeding must be one of {[m.value for m in SeedingMethod]}"
            )
        )

    rng_seed = data.get("rngSeed")
    if rng_seed is not None and not _is_int(rng_seed):
        issues.append(Issue("rngSeed", "invalid", "rngSeed must be an integer"))
    if seeding is SeedingMethod.RANDOM and rng_seed is None:
        issues.append(Issue("rngSeed", "required", "rngSeed is required when seeding is 'random'"))

    if issues or seeding is None:
        raise EngineValidationError(issues)
    resolved_seed = (
        rng_seed if isinstance(rng_seed, int) and not isinstance(rng_seed, bool) else None
    )
    return AdvancementRule(sources=tuple(sources), seeding=seeding, rng_seed=resolved_seed)
