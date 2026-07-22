"""Pure tie rollup — aggregate leg wins into a squad-vs-squad tie outcome.

Sport-agnostic: counts which side won each completed leg. A tie is decided when
one side reaches ``win_threshold`` leg wins (typically ceil(games_per_tie / 2)).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class LegOutcome:
    """One leg result mapped to squad-side indices (0 = home, 1 = away)."""

    winning_side: int | None  # 0, 1, or None if not terminal


@dataclass(frozen=True, slots=True)
class TieRollupState:
    home_leg_wins: int
    away_leg_wins: int
    games_per_tie: int
    win_threshold: int
    decided: bool
    winning_side: int | None  # 0 = home squad, 1 = away, None if undecided


def win_threshold(games_per_tie: int) -> int:
    """Legs needed to clinch (best-of-N)."""
    if games_per_tie < 1:
        raise ValueError("games_per_tie must be at least 1")
    return games_per_tie // 2 + 1


def rollup_legs(*, games_per_tie: int, legs: tuple[LegOutcome, ...]) -> TieRollupState:
    """Count leg wins and determine whether the tie is decided."""
    threshold = win_threshold(games_per_tie)
    home = away = 0
    for leg in legs:
        if leg.winning_side == 0:
            home += 1
        elif leg.winning_side == 1:
            away += 1
    # A tie is over when one side clinches, or when every leg has been played —
    # including when those legs finish level. The level case used to be excluded,
    # so an even number of legs ending 4-4 left the tie permanently "scheduled":
    # both teams had played everything, neither was awarded the draw point, and
    # the fixture never appeared in the standings at all.
    decided = home >= threshold or away >= threshold or home + away >= games_per_tie
    winner: int | None = None
    if decided:
        if home > away:
            winner = 0
        elif away > home:
            winner = 1
    return TieRollupState(
        home_leg_wins=home,
        away_leg_wins=away,
        games_per_tie=games_per_tie,
        win_threshold=threshold,
        decided=decided,
        winning_side=winner,
    )
