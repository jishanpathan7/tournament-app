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


def test_a_level_tie_with_every_leg_played_is_a_draw():
    """Found by running a real tournament: with an even number of legs a 1-1 (or
    4-4) finish left the tie permanently 'scheduled'. Both teams had played
    everything, neither got the draw point, and the fixture never reached the
    standings at all."""
    state = rollup_legs(
        games_per_tie=2,
        legs=(LegOutcome(winning_side=0), LegOutcome(winning_side=1)),
    )
    assert state.decided is True
    assert state.winning_side is None
    assert (state.home_leg_wins, state.away_leg_wins) == (1, 1)


def test_the_sibl_default_of_eight_legs_can_end_level():
    state = rollup_legs(
        games_per_tie=8,
        legs=tuple(LegOutcome(winning_side=i % 2) for i in range(8)),
    )
    assert (state.home_leg_wins, state.away_leg_wins) == (4, 4)
    assert state.decided is True
    assert state.winning_side is None


def test_a_tie_still_waits_while_legs_are_outstanding():
    # Only half played and level — not a draw yet, just unfinished.
    state = rollup_legs(
        games_per_tie=8,
        legs=(LegOutcome(winning_side=0), LegOutcome(winning_side=1)),
    )
    assert state.decided is False
