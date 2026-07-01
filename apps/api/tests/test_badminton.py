"""Badminton Sport Profile tests — pure, no DB, no framework.

Covers capabilities, config, participant validation (singles/doubles), score
validation (valid + invalid + malformed + edge cases), walkovers, retirements,
no-shows, outcome derivation, and statistics generation. Also proves the profile
satisfies the engine's SportProfile contract + plugs into the SportRegistry.
"""

from __future__ import annotations

import pytest

from app.engine import (
    ContractError,
    EngineError,
    EngineValidationError,
    FormatKey,
    OutcomeKind,
    ParticipantKind,
    SideOutcome,
    SportProfile,
    SportRegistry,
    TerminalReason,
    UnknownSportError,
)
from app.sports.badminton import BadmintonProfile

PROFILE = BadmintonProfile()
IDS = ("p0", "p1")


def _validate(payload, config=None):
    PROFILE.validate_result(payload, config or {})


def _derive(payload, config=None, ids=IDS):
    return PROFILE.derive_result(payload, config or {}, side_participant_ids=ids)


# ---- capabilities / contract ----


def test_capabilities():
    assert PROFILE.key == "badminton"
    assert PROFILE.supported_participant_kinds() == frozenset(
        {ParticipantKind.INDIVIDUAL, ParticipantKind.PAIR}
    )
    assert FormatKey.SINGLE_ELIM in PROFILE.supported_formats()
    assert PROFILE.tiebreak_criteria()[0] == "match_wins"
    assert PROFILE.default_config()["best_of"] == 3
    assert PROFILE.match_metadata({}).scoring_unit == "points"


def test_satisfies_sport_profile_protocol_and_registry():
    assert isinstance(PROFILE, SportProfile)
    registry = SportRegistry()
    registry.register(PROFILE)
    assert registry.get("badminton") is PROFILE
    with pytest.raises(EngineError):
        registry.register(PROFILE)  # duplicate
    with pytest.raises(UnknownSportError):
        registry.get("chess")


# ---- config ----


def test_validate_config_accepts_defaults_and_overrides():
    PROFILE.validate_config({})
    PROFILE.validate_config({"best_of": 5, "points_to_win": 15, "win_by": 2, "point_cap": 21})


@pytest.mark.parametrize(
    "config",
    [
        {"best_of": 2},  # even
        {"best_of": 0},  # non-positive
        {"points_to_win": "x"},  # non-int
        {"win_by": 0},
        {"point_cap": 15, "points_to_win": 21},  # cap < points
    ],
)
def test_validate_config_rejects_invalid(config):
    with pytest.raises(EngineValidationError):
        PROFILE.validate_config(config)


# ---- participants (singles / doubles) ----


def test_validate_participants_singles_and_doubles():
    PROFILE.validate_participants(ParticipantKind.INDIVIDUAL, [["a"], ["b"]])
    PROFILE.validate_participants(ParticipantKind.PAIR, [["a", "b"], ["c", "d"]])


@pytest.mark.parametrize(
    "kind,rosters",
    [
        (ParticipantKind.INDIVIDUAL, [["a", "b"], ["c"]]),  # singles side has 2
        (ParticipantKind.PAIR, [["a"], ["c", "d"]]),  # doubles side has 1
        (ParticipantKind.TEAM, [["a"], ["b"]]),  # unsupported kind
    ],
)
def test_validate_participants_rejects(kind, rosters):
    with pytest.raises(EngineValidationError):
        PROFILE.validate_participants(kind, rosters)


# ---- valid scores ----


@pytest.mark.parametrize(
    "games",
    [
        [[21, 15], [21, 10]],  # 2-0
        [[21, 15], [15, 21], [21, 18]],  # 2-1
        [[22, 20], [21, 19]],  # deuce win
        [[30, 29], [21, 10]],  # golden point cap
        [[30, 28], [21, 10]],  # win-by-2 at cap
    ],
)
def test_valid_normal_matches(games):
    _validate({"games": games})  # no raise


# ---- invalid scores ----


@pytest.mark.parametrize(
    "games,reason",
    [
        ([[21, 20], [21, 10]], "21-20 is not complete (win by 2)"),
        ([[24, 20], [21, 10]], "24-20 illegal (margin > 2 below cap)"),
        ([[31, 29], [21, 10]], "31 exceeds the cap"),
        ([[30, 27], [21, 10]], "30-27 illegal at cap"),
        ([[21, 10]], "single game cannot decide best-of-3"),
        ([[21, 10], [21, 10], [21, 10]], "games after the match was decided"),
        ([[21, 10], [10, 21], [10, 21], [21, 10]], "too many games"),
    ],
)
def test_invalid_normal_scores(games, reason):
    with pytest.raises(EngineValidationError):
        _validate({"games": games})


# ---- malformed payloads ----


@pytest.mark.parametrize(
    "payload",
    [
        {"games": "nope"},
        {"games": [[21]]},  # not a pair
        {"games": [[21, "x"]]},  # non-int
        {"games": [[21, -1]]},  # negative
        {"endedBy": "bogus", "games": [[21, 10], [21, 10]]},
    ],
)
def test_malformed_payloads(payload):
    with pytest.raises(EngineValidationError):
        _validate(payload)


# ---- walkover / no-show ----


def test_walkover_valid_and_missing_winner():
    _validate({"endedBy": "walkover", "walkoverWinner": 1})
    with pytest.raises(EngineValidationError):
        _validate({"endedBy": "walkover"})
    _validate({"endedBy": "no_show", "walkoverWinner": 0})


# ---- retirement ----


def test_retirement_valid_partial_last_game():
    # game 3 is in progress (retired mid-game) — allowed only as the last game
    _validate({"endedBy": "retirement", "retiredSide": 0, "games": [[21, 15], [15, 21], [10, 5]]})


@pytest.mark.parametrize(
    "payload",
    [
        {"endedBy": "retirement", "games": [[21, 15]]},  # missing retiredSide
        {
            "endedBy": "retirement",
            "retiredSide": 0,
            "games": [[10, 5], [21, 15]],
        },  # non-last partial
    ],
)
def test_retirement_invalid(payload):
    with pytest.raises(EngineValidationError):
        _validate(payload)


# ---- outcome derivation + statistics ----


def test_derive_singles_2_0():
    report = _derive({"games": [[21, 15], [21, 10]]})
    assert report.terminal_reason is TerminalReason.NORMAL
    assert report.outcome.kind is OutcomeKind.WINNER and report.outcome.winner_id == "p0"
    winner, loser = report.sides
    assert winner.participant_id == "p0" and winner.outcome is SideOutcome.WIN
    assert winner.score_for == 2 and winner.score_against == 0
    assert loser.participant_id == "p1" and loser.outcome is SideOutcome.LOSS
    assert report.statistics["p0"] == {
        "games_won": 2,
        "games_lost": 0,
        "points_for": 42,
        "points_against": 25,
    }


def test_derive_doubles_maps_participant_ids():
    report = _derive({"games": [[21, 15], [21, 10]]}, ids=("teamA", "teamB"))
    assert report.outcome.winner_id == "teamA"
    assert {s.participant_id for s in report.sides} == {"teamA", "teamB"}


def test_derive_2_1_statistics():
    report = _derive({"games": [[21, 15], [15, 21], [21, 18]]})
    assert report.outcome.winner_id == "p0"
    assert report.statistics["p0"]["games_won"] == 2 and report.statistics["p0"]["games_lost"] == 1
    assert report.statistics["p1"]["points_for"] == 15 + 21 + 18


def test_derive_walkover():
    report = _derive({"endedBy": "walkover", "walkoverWinner": 1})
    assert report.terminal_reason is TerminalReason.WALKOVER
    assert report.outcome.winner_id == "p1"
    winner = next(s for s in report.sides if s.outcome is SideOutcome.WIN)
    assert winner.participant_id == "p1" and winner.score_for == 0


def test_derive_retirement_winner_is_non_retiree():
    report = _derive(
        {"endedBy": "retirement", "retiredSide": 0, "games": [[21, 15], [15, 21], [10, 5]]}
    )
    assert report.terminal_reason is TerminalReason.RETIREMENT
    assert report.outcome.winner_id == "p1"
    assert report.statistics["p1"]["points_for"] == 15 + 21 + 5


def test_derive_requires_two_sides():
    with pytest.raises(ContractError):
        PROFILE.derive_result({"games": [[21, 10], [21, 10]]}, {}, side_participant_ids=("only",))


def test_derive_is_deterministic():
    payload = {"games": [[21, 15], [15, 21], [21, 18]]}
    assert _derive(payload) == _derive(payload)
