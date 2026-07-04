"""Unit tests for franchise tie rollup engine."""

from app.engine.tie_rollup import LegOutcome, rollup_legs, win_threshold


def test_win_threshold_best_of_five():
    assert win_threshold(5) == 3


def test_win_threshold_best_of_three():
    assert win_threshold(3) == 2


def test_rollup_undecided():
    state = rollup_legs(
        games_per_tie=5,
        legs=(LegOutcome(0), LegOutcome(1), LegOutcome(None)),
    )
    assert state.home_leg_wins == 1
    assert state.away_leg_wins == 1
    assert not state.decided
    assert state.winning_side is None


def test_rollup_home_clinches():
    state = rollup_legs(
        games_per_tie=5,
        legs=(LegOutcome(0), LegOutcome(0), LegOutcome(0)),
    )
    assert state.decided
    assert state.winning_side == 0
    assert state.home_leg_wins == 3


def test_rollup_all_legs_played_away_wins():
    state = rollup_legs(
        games_per_tie=3,
        legs=(LegOutcome(0), LegOutcome(1), LegOutcome(1)),
    )
    assert state.decided
    assert state.winning_side == 1
