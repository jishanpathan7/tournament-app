"""Resolve sport match config from tournament → stage layers (sport-agnostic seam)."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from app.engine.sport import SportProfile

# Keys owned by Sport Profiles (not the format engine). May live in stage.config
# alongside format keys like ``cycles``, or under tournament.settings.sportConfig.
SPORT_CONFIG_KEYS = frozenset({"best_of", "points_per_set", "win_by", "max_points"})

_CAMEL_TO_SNAKE = {
    "bestOf": "best_of",
    # canonical names
    "pointsPerSet": "points_per_set",
    "maxPoints": "max_points",
    # backward-compat aliases (old wire names still accepted)
    "pointsToWin": "points_per_set",
    "pointCap": "max_points",
    "winBy": "win_by",
}


def normalize_sport_config(raw: Mapping[str, Any] | None) -> dict[str, Any]:
    """Extract sport keys from a dict, accepting camelCase or snake_case."""
    if not raw:
        return {}
    out: dict[str, Any] = {}
    for key, value in raw.items():
        normalized = _CAMEL_TO_SNAKE.get(key, key)
        if normalized in SPORT_CONFIG_KEYS:
            out[normalized] = value
    return out


def merge_sport_config(
    profile: SportProfile,
    *,
    tournament_settings: Mapping[str, Any] | None = None,
    stage_config: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Layer defaults ← tournament.settings.sportConfig ← stage.config sport keys."""
    merged = dict(profile.default_config())
    settings = tournament_settings or {}
    nested = settings.get("sportConfig") or settings.get("sport_config") or {}
    for layer in (
        normalize_sport_config(nested if isinstance(nested, Mapping) else {}),
        normalize_sport_config(settings),
        normalize_sport_config(stage_config or {}),
    ):
        merged.update(layer)
    return merged


def sport_config_view(config: Mapping[str, Any]) -> dict[str, int]:
    """Wire shape for API schemas (snake_case; ApiModel emits camelCase)."""
    return {
        "best_of": int(config["best_of"]),
        "points_per_set": int(config["points_per_set"]),
        "win_by": int(config["win_by"]),
        "max_points": int(config["max_points"]),
    }
