"""Default ``StandingsEngine`` — computes standings from completed match results.

Pure + deterministic. Ranking is **configurable through the SportProfile**: the sport
supplies the ordered tie-break criteria (via ``TiebreakPolicy``); this engine provides
a library of standard comparators and resolves ties by applying the criteria in order,
recursing into still-tied groups. ``head_to_head`` is contextual (records among the
tied set only). A stable ``participant_id`` fallback guarantees a total, deterministic
order. Future sports reorder the standard criteria or inject custom comparators —
no engine change.
"""

from __future__ import annotations

import dataclasses
from collections.abc import Callable, Mapping, Sequence
from decimal import Decimal
from typing import Any

from app.engine.contracts import StandingsRequest
from app.engine.errors import EngineValidationError, Issue
from app.engine.types import (
    MatchResult,
    ParticipantId,
    PointsPolicy,
    SideOutcome,
    SideResult,
    StandingRow,
    TerminalReason,
)

# A comparator maps a row to a sortable value; higher is better.
Comparator = Callable[[StandingRow], "Decimal | int"]

HEAD_TO_HEAD = "head_to_head"

STANDARD_COMPARATORS: dict[str, Comparator] = {
    "match_wins": lambda r: r.won,
    "wins": lambda r: r.won,
    "points": lambda r: r.points,
    "game_diff": lambda r: r.score_for - r.score_against,
    "games_won": lambda r: r.score_for,
    "point_diff": lambda r: r.metrics.get("points_for", 0) - r.metrics.get("points_against", 0),
    "points_scored": lambda r: r.metrics.get("points_for", 0),
}


class _Tally:
    """Mutable per-participant accumulator, frozen into a StandingRow at the end."""

    def __init__(self, participant_id: ParticipantId, group_key: str | None) -> None:
        self.participant_id = participant_id
        self.group_key = group_key
        self.played = self.won = self.drawn = self.lost = 0
        self.points = Decimal(0)
        self.score_for = self.score_against = 0
        self.metrics: dict[str, int] = {}

    def add(
        self,
        outcome: SideOutcome,
        reason: TerminalReason,
        side: SideResult,
        policy: PointsPolicy,
    ) -> None:
        self.played += 1
        self.score_for += side.score_for
        self.score_against += side.score_against
        for key, value in side.metrics.items():
            self.metrics[key] = self.metrics.get(key, 0) + int(value)
        if outcome is SideOutcome.WIN:
            self.won += 1
            walkover = reason in (TerminalReason.WALKOVER, TerminalReason.NO_SHOW)
            self.points += policy.walkover if walkover else policy.win
        elif outcome is SideOutcome.DRAW:
            self.drawn += 1
            self.points += policy.draw
        elif outcome is SideOutcome.LOSS:
            self.lost += 1
            self.points += policy.loss
        # RANK (N-sided) contributes to `played` only; ranked scoring is future work.

    def freeze(self) -> StandingRow:
        return StandingRow(
            participant_id=self.participant_id,
            group_key=self.group_key,
            played=self.played,
            won=self.won,
            drawn=self.drawn,
            lost=self.lost,
            points=self.points,
            score_for=self.score_for,
            score_against=self.score_against,
            metrics=dict(self.metrics),
        )


class DefaultStandingsEngine:
    """Satisfies ``app.engine.StandingsEngine``."""

    def __init__(self, comparators: Mapping[str, Comparator] | None = None) -> None:
        self._comparators: dict[str, Comparator] = dict(STANDARD_COMPARATORS)
        if comparators:
            self._comparators.update(comparators)

    def compute(self, request: StandingsRequest) -> tuple[StandingRow, ...]:
        known = {p.id for p in request.participants}
        tallies = {p.id: _Tally(p.id, request.group_key) for p in request.participants}

        for result in request.results:
            for side in result.sides:
                if side.participant_id in known:
                    tallies[side.participant_id].add(
                        side.outcome, result.terminal_reason, side, request.points
                    )

        rows = [tallies[pid].freeze() for pid in tallies]
        ordered = self._order(rows, request.results, tuple(request.tiebreak.criteria))
        return tuple(dataclasses.replace(row, rank=index + 1) for index, row in enumerate(ordered))

    # ---- ranking ----

    def _order(
        self, rows: list[StandingRow], results: Sequence[MatchResult], criteria: tuple[str, ...]
    ) -> list[StandingRow]:
        if len(rows) <= 1 or not criteria:
            return sorted(rows, key=lambda r: r.participant_id)  # deterministic fallback

        crit, rest = criteria[0], criteria[1:]
        keyed: list[tuple[Any, StandingRow]]
        if crit == HEAD_TO_HEAD:
            member_ids = {r.participant_id for r in rows}
            keyed = [(_head_to_head_key(r.participant_id, member_ids, results), r) for r in rows]
        else:
            comparator = self._comparators.get(crit)
            if comparator is None:
                raise EngineValidationError(
                    [
                        Issue(
                            "tiebreak", "unknown_criterion", f"unknown tie-break criterion {crit!r}"
                        )
                    ]
                )
            keyed = [(comparator(r), r) for r in rows]

        keyed.sort(key=lambda pair: pair[0], reverse=True)
        result: list[StandingRow] = []
        i = 0
        while i < len(keyed):
            j = i
            while j < len(keyed) and keyed[j][0] == keyed[i][0]:
                j += 1
            group = [row for _key, row in keyed[i:j]]
            result.extend(self._order(group, results, rest) if len(group) > 1 else group)
            i = j
        return result


def _head_to_head_key(
    participant_id: ParticipantId,
    members: set[ParticipantId],
    results: Sequence[MatchResult],
) -> tuple[int, int, int]:
    """Record (wins, game_diff, point_diff) among matches where *both* sides are in the
    tied set — the standard 'results between tied competitors' rule. Higher is better."""
    wins = game_diff = point_diff = 0
    for result in results:
        sides = result.sides
        if len(sides) != 2:
            continue
        ids = {s.participant_id for s in sides}
        if not (ids <= members) or participant_id not in ids:
            continue
        mine = next(s for s in sides if s.participant_id == participant_id)
        if mine.outcome is SideOutcome.WIN:
            wins += 1
        game_diff += mine.score_for - mine.score_against
        point_diff += mine.metrics.get("points_for", 0) - mine.metrics.get("points_against", 0)
    return (wins, game_diff, point_diff)
