"""Every pair gets on court.

A team with more pairs than the field used to have its extras stranded: legs per
tie were sized to the SMALLEST team, so an 8th pair was never reachable and those
two players went home having played nothing. Legs are now sized to the largest
team, and the starting pair rotates per tie so a short-handed team does not work
the same pair twice in every tie.
"""

from __future__ import annotations

from collections import Counter

from app.modules.franchise_ties.service import _leg_pair_index


def _appearances(pair_count: int, games_per_tie: int, ties: int) -> Counter[int]:
    counts: Counter[int] = Counter()
    for tie_index in range(ties):
        for leg_index in range(games_per_tie):
            counts[_leg_pair_index(tie_index, leg_index, games_per_tie, pair_count)] += 1
    return counts


def test_the_extra_pair_of_a_bigger_team_actually_plays():
    # 8 pairs vs a field where 7 was the old leg count: pair index 7 was unreachable.
    counts = _appearances(pair_count=8, games_per_tie=8, ties=6)
    assert len(counts) == 8
    assert min(counts.values()) > 0


def test_no_pair_is_ever_left_with_zero_matches():
    for pair_count in range(1, 13):
        counts = _appearances(pair_count=pair_count, games_per_tie=8, ties=6)
        assert len(counts) == pair_count, f"{pair_count} pairs: some pair never played"


def test_a_short_handed_team_spreads_the_double_shift():
    # 7 pairs across 8 legs: someone must play twice per tie. Without the rotation
    # it was always pair 1, carrying double the load all tournament.
    counts = _appearances(pair_count=7, games_per_tie=8, ties=6)
    assert max(counts.values()) - min(counts.values()) <= 1


def test_rotation_is_deterministic():
    # Same inputs, same line-up — a redraw must not reshuffle who plays whom.
    first = _appearances(pair_count=7, games_per_tie=8, ties=6)
    assert first == _appearances(pair_count=7, games_per_tie=8, ties=6)
