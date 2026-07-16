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
