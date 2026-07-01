"""StandingsEngine tests — pure, no DB.

Covers stat accumulation (wins/losses/draws, games, points), the full sport-driven
tie-break chain (match wins → head-to-head → game diff → point diff), walkover
points, malformed/edge inputs, and determinism.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.engine import (
    DefaultStandingsEngine,
    EngineValidationError,
    MatchResult,
    ParticipantRef,
    PointsPolicy,
    SideOutcome,
    SideResult,
    StandingsRequest,
    TerminalReason,
    TiebreakPolicy,
)
from app.sports.badminton import BadmintonProfile

ENGINE = DefaultStandingsEngine()
WIN_LOSS = PointsPolicy(win=Decimal(1), draw=Decimal(0), loss=Decimal(0))
BADMINTON_CRITERIA = TiebreakPolicy(criteria=BadmintonProfile().tiebreak_criteria())


def _m(key, winner, loser, wg, lg, wp, lp, reason=TerminalReason.NORMAL):
    """A completed match: winner takes `wg` games / `wp` points, loser `lg`/`lp`."""
    return MatchResult(
        match_key=key,
        sides=(
            SideResult(
                winner, SideOutcome.WIN, wg, lg, metrics={"points_for": wp, "points_against": lp}
            ),
            SideResult(
                loser, SideOutcome.LOSS, lg, wg, metrics={"points_for": lp, "points_against": wp}
            ),
        ),
        terminal_reason=reason,
    )


def _compute(participants, results, points=WIN_LOSS, tiebreak=BADMINTON_CRITERIA, group_key=None):
    request = StandingsRequest(
        participants=tuple(ParticipantRef(id=p) for p in participants),
        results=tuple(results),
        points=points,
        tiebreak=tiebreak,
        group_key=group_key,
    )
    return {row.participant_id: row for row in ENGINE.compute(request)}, ENGINE.compute(request)


# ---- accumulation ----


def test_accumulates_all_dimensions():
    rows, _ = _compute(["p0", "p1"], [_m("M1", "p0", "p1", 2, 0, 42, 25)])
    p0, p1 = rows["p0"], rows["p1"]
    assert (p0.played, p0.won, p0.lost, p0.drawn) == (1, 1, 0, 0)
    assert p0.points == Decimal(1)
    assert (p0.score_for, p0.score_against, p0.diff) == (2, 0, 2)  # games
    assert p0.metrics["points_for"] == 42 and p0.metrics["points_against"] == 25
    assert (p1.won, p1.lost) == (0, 1) and p1.diff == -2 and p1.rank == 2
    assert p0.rank == 1


def test_draws_are_supported_even_if_badminton_never_uses_them():
    draw = MatchResult(
        "D1",
        (
            SideResult("p0", SideOutcome.DRAW, 1, 1),
            SideResult("p1", SideOutcome.DRAW, 1, 1),
        ),
    )
    rows, _ = _compute(["p0", "p1"], [draw], points=PointsPolicy(win=Decimal(3), draw=Decimal(1)))
    assert rows["p0"].drawn == 1 and rows["p0"].points == Decimal(1)


# ---- ranking ----


def test_ranks_by_match_wins():
    results = [
        _m("M1", "p0", "p1", 2, 0, 42, 20),
        _m("M2", "p0", "p2", 2, 0, 42, 20),
        _m("M3", "p1", "p2", 2, 0, 42, 20),
    ]
    _, ordered = _compute(["p0", "p1", "p2"], results)
    assert [r.participant_id for r in ordered] == ["p0", "p1", "p2"]


def test_head_to_head_breaks_a_two_way_win_tie():
    # p0 and p1 both finish 2 wins; p0 beat p1 head-to-head ⇒ p0 ranked above p1.
    results = [
        _m("M1", "p0", "p1", 2, 0, 42, 30),  # p0 beats p1
        _m("M2", "p0", "p2", 2, 0, 42, 10),
        _m("M3", "p1", "p2", 2, 0, 42, 10),
        _m("M4", "p1", "p3", 2, 0, 42, 10),
        _m("M5", "p3", "p0", 2, 1, 50, 48),  # p3 beats p0
    ]
    _, ordered = _compute(["p0", "p1", "p2", "p3"], results)
    ids = [r.participant_id for r in ordered]
    assert ids.index("p0") < ids.index("p1")  # head-to-head favours p0
    assert ids[0] in ("p0", "p1") and ids[-1] == "p2"


def test_point_diff_breaks_tie_when_wins_and_games_equal():
    # both beat p2 2-0 (equal wins + game diff), never meet ⇒ point diff decides.
    results = [
        _m("M1", "p0", "p2", 2, 0, 42, 20),  # p0 point diff +22
        _m("M2", "p1", "p2", 2, 0, 42, 30),  # p1 point diff +12
    ]
    _, ordered = _compute(["p0", "p1", "p2"], results)
    assert [r.participant_id for r in ordered] == ["p0", "p1", "p2"]


def test_walkover_awards_walkover_points_not_win_points():
    policy = PointsPolicy(win=Decimal(3), walkover=Decimal(1), loss=Decimal(0))
    walkover = MatchResult(
        "W1",
        (SideResult("p0", SideOutcome.WIN, 0, 0), SideResult("p1", SideOutcome.LOSS, 0, 0)),
        terminal_reason=TerminalReason.WALKOVER,
    )
    rows, _ = _compute(["p0", "p1"], [walkover], points=policy)
    assert rows["p0"].points == Decimal(1)  # walkover, not the normal win value of 3
    assert rows["p1"].points == Decimal(0)


# ---- edge / malformed ----


def test_empty_participants_returns_empty():
    _, ordered = _compute([], [])
    assert ordered == ()


def test_results_for_unknown_participants_are_ignored():
    rows, _ = _compute(["p0"], [_m("M1", "ghost", "phantom", 2, 0, 42, 0)])
    assert rows["p0"].played == 0


def test_unknown_tiebreak_criterion_raises():
    with pytest.raises(EngineValidationError):
        _compute(
            ["p0", "p1"], [_m("M1", "p0", "p1", 2, 0, 42, 20)], tiebreak=TiebreakPolicy(("bogus",))
        )


def test_no_results_ranks_deterministically_by_id():
    _, ordered = _compute(["p2", "p0", "p1"], [])
    assert [r.participant_id for r in ordered] == ["p0", "p1", "p2"]


def test_deterministic():
    results = [_m("M1", "p0", "p1", 2, 1, 45, 40), _m("M2", "p1", "p2", 2, 0, 42, 20)]
    _, a = _compute(["p0", "p1", "p2"], results)
    _, b = _compute(["p0", "p1", "p2"], results)
    assert a == b
