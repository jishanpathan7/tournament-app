"""Sport config resolution — tournament defaults + stage overrides."""

from __future__ import annotations

from app.sports.badminton import BadmintonProfile
from app.sports.config import merge_sport_config, normalize_sport_config

PROFILE = BadmintonProfile()


def test_merge_defaults_when_empty():
    cfg = merge_sport_config(PROFILE)
    assert cfg["best_of"] == 3
    assert cfg["points_per_set"] == 21


def test_tournament_sport_config_nested():
    cfg = merge_sport_config(
        PROFILE,
        tournament_settings={"sportConfig": {"bestOf": 1}},
    )
    assert cfg["best_of"] == 1


def test_stage_overrides_tournament():
    cfg = merge_sport_config(
        PROFILE,
        tournament_settings={"sportConfig": {"best_of": 3}},
        stage_config={"cycles": 2, "best_of": 5},
    )
    assert cfg["best_of"] == 5
    PROFILE.validate_config(cfg)


def test_normalize_camel_case():
    assert normalize_sport_config({"bestOf": 1, "pointsToWin": 15}) == {
        "best_of": 1,
        "points_per_set": 15,
    }


def test_format_keys_ignored_in_normalize():
    assert normalize_sport_config({"cycles": 2, "best_of": 1}) == {"best_of": 1}


def test_normalize_new_canonical_camel_case():
    """New canonical names pointsPerSet/maxPoints normalize correctly."""
    assert normalize_sport_config({"pointsPerSet": 15, "maxPoints": 21}) == {
        "points_per_set": 15,
        "max_points": 21,
    }


def test_normalize_old_aliases_still_work():
    """Old aliases pointsToWin/pointCap still map to the canonical snake_case keys."""
    result = normalize_sport_config({"pointsToWin": 15, "pointCap": 21})
    assert result == {"points_per_set": 15, "max_points": 21}


def test_merge_sibl_stage_config():
    """Stage config with SIBL rules (camelCase) merges correctly over defaults."""
    cfg = merge_sport_config(
        PROFILE,
        stage_config={"pointsPerSet": 15, "maxPoints": 21},
    )
    assert cfg["points_per_set"] == 15
    assert cfg["max_points"] == 21
    assert cfg["win_by"] == 2
    assert cfg["best_of"] == 3
    PROFILE.validate_config(cfg)
