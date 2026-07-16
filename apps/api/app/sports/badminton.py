"""Badminton Sport Profile — the reference implementation of ``SportProfile``.

Owns every badminton rule; depends only on ``app.engine`` (pure — no FastAPI /
SQLAlchemy / DB). Singles (individual) and doubles (pair) share identical scoring;
they differ only in roster size, enforced by ``validate_participants``.

Result payload shape (opaque to the engine, defined + validated here):

    {
      "games": [[21, 15], [21, 18]],           # per-game [sideA, sideB] point scores
      "endedBy": "normal" | "walkover" | "retirement" | "no_show",   # default "normal"
      "walkoverWinner": 0 | 1,                  # required for walkover / no_show
      "retiredSide": 0 | 1                      # required for retirement
    }

Sides are index 0/1; ``derive_result`` maps them to the match's participant ids.
Config: ``best_of`` (odd), ``points_per_set``, ``win_by``, ``max_points``.
"""

from __future__ import annotations

import enum
from collections.abc import Mapping, Sequence
from decimal import Decimal
from typing import Any

from app.engine.errors import ContractError, EngineValidationError, Issue
from app.engine.sport import MatchMetadata, MatchReport
from app.engine.types import (
    FormatKey,
    Outcome,
    PairingPolicy,
    PairingStrategy,
    ParticipantId,
    ParticipantKind,
    SideOutcome,
    SideResult,
    TerminalReason,
)

_DEFAULTS: dict[str, int] = {"best_of": 3, "points_per_set": 21, "win_by": 2, "max_points": 30}
_ROSTER_SIZE = {ParticipantKind.INDIVIDUAL: 1, ParticipantKind.PAIR: 2}
_ENDED_BY = {r.value: r for r in TerminalReason}

# Doubles fairness weights (SIBL fairness engine): beginner=1, intermediate=2, advanced=3.
# A doubles team's strength is the sum of its two players' weights (range 2..6); the
# fair target is the midpoint, 4 — so a "3+1" advanced+beginner team balances a "2+2".
_SKILL_WEIGHT: dict[str, Decimal] = {
    "beginner": Decimal(1),
    "intermediate": Decimal(2),
    "advanced": Decimal(3),
}
_DEFAULT_WEIGHT = Decimal(2)  # unknown/blank skill ⇒ treated as intermediate
_DOUBLES_TARGET_STRENGTH = Decimal(4)


class _GameState(enum.Enum):
    A_WON = "a"
    B_WON = "b"
    IN_PROGRESS = "in_progress"
    INVALID = "invalid"


def _is_pos_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value > 0


def _game_state(a: int, b: int, points: int, win_by: int, cap: int) -> _GameState:
    """Classify a single game's [a, b] score under badminton rally scoring."""
    if a == b:
        return _GameState.IN_PROGRESS  # tie ⇒ no winner yet
    hi, lo = (a, b) if a > b else (b, a)
    winner = _GameState.A_WON if a > b else _GameState.B_WON
    margin = hi - lo
    if hi > cap:
        return _GameState.INVALID
    if hi < points:
        return _GameState.IN_PROGRESS  # nobody reached the target yet
    if hi == points:
        return winner if margin >= win_by else _GameState.IN_PROGRESS  # 21-19 vs 21-20
    if hi < cap:  # deuce phase: must win by exactly `win_by`
        if margin == win_by:
            return winner
        return _GameState.IN_PROGRESS if margin < win_by else _GameState.INVALID
    # hi == cap (golden point / capped): valid only as cap-1 or cap-2 behind
    return winner if lo >= cap - win_by else _GameState.INVALID


class BadmintonProfile:
    """Satisfies ``app.engine.SportProfile``."""

    key = "badminton"

    # --- capabilities ---

    def supported_participant_kinds(self) -> frozenset[ParticipantKind]:
        return frozenset({ParticipantKind.INDIVIDUAL, ParticipantKind.PAIR, ParticipantKind.SQUAD})

    def supported_formats(self) -> frozenset[FormatKey]:
        return frozenset(
            {
                FormatKey.ROUND_ROBIN,
                FormatKey.SINGLE_ELIM,
                FormatKey.GROUP_KNOCKOUT,
                FormatKey.SWISS,
            }
        )

    def tiebreak_criteria(self) -> tuple[str, ...]:
        return ("match_wins", "head_to_head", "game_diff", "point_diff")

    # --- configuration ---

    def default_config(self) -> Mapping[str, Any]:
        return dict(_DEFAULTS)

    def validate_config(self, config: Mapping[str, Any]) -> None:
        issues: list[Issue] = []
        best_of = config.get("best_of", _DEFAULTS["best_of"])
        if not _is_pos_int(best_of) or best_of % 2 == 0:
            issues.append(Issue("best_of", "invalid", "best_of must be a positive odd integer"))
        points = config.get("points_per_set", _DEFAULTS["points_per_set"])
        if not _is_pos_int(points):
            issues.append(
                Issue("points_per_set", "invalid", "points_per_set must be a positive integer")
            )
        win_by = config.get("win_by", _DEFAULTS["win_by"])
        if not _is_pos_int(win_by):
            issues.append(Issue("win_by", "invalid", "win_by must be a positive integer"))
        cap = config.get("max_points", _DEFAULTS["max_points"])
        if not _is_pos_int(cap) or (_is_pos_int(points) and cap < points):
            issues.append(
                Issue("max_points", "invalid", "max_points must be an integer >= points_per_set")
            )
        if issues:
            raise EngineValidationError(issues)

    def match_metadata(self, config: Mapping[str, Any]) -> MatchMetadata:
        best_of, _, _, _ = self._resolve(config)
        return MatchMetadata(scoring_unit="points", sides=2, estimated_minutes=best_of * 20)

    # --- participants ---

    def validate_participants(
        self, kind: ParticipantKind, side_rosters: Sequence[Sequence[ParticipantId]]
    ) -> None:
        if kind not in _ROSTER_SIZE:
            raise EngineValidationError(
                [Issue("kind", "unsupported", f"badminton does not support {kind.value!r}")]
            )
        expected = _ROSTER_SIZE[kind]
        issues: list[Issue] = []
        for index, roster in enumerate(side_rosters):
            if len(roster) != expected:
                issues.append(
                    Issue(
                        f"sides[{index}]",
                        "roster_size",
                        f"{kind.value} requires {expected} player(s), got {len(roster)}",
                    )
                )
        if issues:
            raise EngineValidationError(issues)

    # --- team formation (pairing) ---

    def pairing_policy(self, config: Mapping[str, Any]) -> PairingPolicy:
        """Doubles = balanced pairs of two (target strength 4); singles never pair.

        A tournament configures which via ``config["participantType"]``; absent that,
        the presence of a doubles division is what drives pairing, so we default to the
        doubles policy (the only kind pairing is meaningful for)."""
        kind = config.get("participantType") or config.get("kind")
        if kind == ParticipantKind.INDIVIDUAL.value:
            return PairingPolicy(team_size=1)
        return PairingPolicy(
            team_size=2,
            target_strength=_DOUBLES_TARGET_STRENGTH,
            strategy=PairingStrategy.BALANCE,
        )

    def skill_weight(self, skill: str | None) -> Decimal:
        if skill is None:
            return _DEFAULT_WEIGHT
        return _SKILL_WEIGHT.get(skill.lower(), _DEFAULT_WEIGHT)

    # --- results ---

    def validate_result(self, payload: Mapping[str, Any], config: Mapping[str, Any]) -> None:
        best_of, points, win_by, cap = self._resolve(config)
        reason = self._reason(payload)
        issues: list[Issue] = []
        if reason is None:
            raise EngineValidationError(
                [Issue("endedBy", "invalid", f"endedBy must be one of {sorted(_ENDED_BY)}")]
            )

        if reason in (TerminalReason.WALKOVER, TerminalReason.NO_SHOW):
            if payload.get("walkoverWinner") not in (0, 1):
                issues.append(Issue("walkoverWinner", "required", "walkoverWinner must be 0 or 1"))
            if issues:
                raise EngineValidationError(issues)
            return

        games = self._parse_games(payload, issues)
        if reason is TerminalReason.RETIREMENT:
            if payload.get("retiredSide") not in (0, 1):
                issues.append(Issue("retiredSide", "required", "retiredSide must be 0 or 1"))
            self._validate_games(
                games, best_of, points, win_by, cap, allow_partial=True, issues=issues
            )
        else:  # NORMAL
            self._validate_games(
                games, best_of, points, win_by, cap, allow_partial=False, issues=issues
            )
        if issues:
            raise EngineValidationError(issues)

    def derive_result(
        self,
        payload: Mapping[str, Any],
        config: Mapping[str, Any],
        *,
        side_participant_ids: Sequence[ParticipantId],
    ) -> MatchReport:
        if len(side_participant_ids) != 2:
            raise ContractError("badminton is a 2-sided sport; expected exactly 2 participant ids")
        self.validate_result(payload, config)  # defensive: never derive from an invalid payload
        best_of, points, win_by, cap = self._resolve(config)
        reason = self._reason(payload)
        assert reason is not None  # validate_result would have raised

        if reason in (TerminalReason.WALKOVER, TerminalReason.NO_SHOW):
            winner = int(payload["walkoverWinner"])
            return self._report([0, 0], [0, 0], winner, side_participant_ids, reason)

        games = self._parse_games(payload, [])
        games_won, points_for = self._tally(games, points, win_by, cap)
        if reason is TerminalReason.RETIREMENT:
            winner = 1 - int(payload["retiredSide"])
        else:  # NORMAL — the side reaching the game majority
            majority = best_of // 2 + 1
            winner = 0 if games_won[0] >= majority else 1
        return self._report(games_won, points_for, winner, side_participant_ids, reason)

    # --- internals ---

    @staticmethod
    def _resolve(config: Mapping[str, Any]) -> tuple[int, int, int, int]:
        def positive(key: str) -> int:
            value = config.get(key, _DEFAULTS[key])
            return value if _is_pos_int(value) else _DEFAULTS[key]

        best_of, points, win_by = (
            positive("best_of"),
            positive("points_per_set"),
            positive("win_by"),
        )
        cap_raw = config.get("max_points", _DEFAULTS["max_points"])
        cap = (
            cap_raw
            if _is_pos_int(cap_raw) and cap_raw >= points
            else max(points, _DEFAULTS["max_points"])
        )
        return best_of, points, win_by, cap

    @staticmethod
    def _reason(payload: Mapping[str, Any]) -> TerminalReason | None:
        return _ENDED_BY.get(payload.get("endedBy", "normal"))

    @staticmethod
    def _parse_games(payload: Mapping[str, Any], issues: list[Issue]) -> list[tuple[int, int]]:
        raw = payload.get("games", [])
        games: list[tuple[int, int]] = []
        if not isinstance(raw, Sequence) or isinstance(raw, (str, bytes)):
            issues.append(Issue("games", "invalid", "games must be an array"))
            return games
        for index, game in enumerate(raw):
            if (
                not isinstance(game, Sequence)
                or isinstance(game, (str, bytes))
                or len(game) != 2
                or not all(isinstance(x, int) and not isinstance(x, bool) and x >= 0 for x in game)
            ):
                issues.append(
                    Issue(f"games[{index}]", "invalid", "each game must be [int, int] >= 0")
                )
                continue
            games.append((int(game[0]), int(game[1])))
        return games

    def _validate_games(
        self,
        games: list[tuple[int, int]],
        best_of: int,
        points: int,
        win_by: int,
        cap: int,
        *,
        allow_partial: bool,
        issues: list[Issue],
    ) -> None:
        if not games and not allow_partial:
            issues.append(Issue("games", "required", "a normal result needs at least one game"))
            return
        majority = best_of // 2 + 1
        wins = [0, 0]
        decided_at: int | None = None
        for index, (a, b) in enumerate(games):
            state = _game_state(a, b, points, win_by, cap)
            is_last = index == len(games) - 1
            if state is _GameState.INVALID:
                issues.append(
                    Issue(f"games[{index}]", "invalid_score", f"illegal game score {a}-{b}")
                )
                continue
            if state is _GameState.IN_PROGRESS:
                if not (allow_partial and is_last):
                    issues.append(
                        Issue(f"games[{index}]", "incomplete", f"game {a}-{b} is not complete")
                    )
                continue
            wins[0 if state is _GameState.A_WON else 1] += 1
            if decided_at is None and max(wins) >= majority:
                decided_at = index

        if allow_partial:
            return  # retirement: winner is the non-retiree regardless of game count
        # normal: exactly one side reaches the majority, with no games played after that
        if max(wins) < majority or wins[0] == wins[1] == majority:
            issues.append(
                Issue("games", "undecided", f"no side won {majority} games (best of {best_of})")
            )
        if decided_at is not None and decided_at != len(games) - 1:
            issues.append(
                Issue("games", "extra_games", "games recorded after the match was decided")
            )

    @staticmethod
    def _tally(
        games: list[tuple[int, int]], points: int, win_by: int, cap: int
    ) -> tuple[list[int], list[int]]:
        games_won = [0, 0]
        points_for = [0, 0]
        for a, b in games:
            points_for[0] += a
            points_for[1] += b
            state = _game_state(a, b, points, win_by, cap)
            if state is _GameState.A_WON:
                games_won[0] += 1
            elif state is _GameState.B_WON:
                games_won[1] += 1
        return games_won, points_for

    @staticmethod
    def _report(
        games_won: list[int],
        points_for: list[int],
        winner: int,
        ids: Sequence[ParticipantId],
        reason: TerminalReason,
    ) -> MatchReport:
        loser = 1 - winner

        def _side(i: int, outcome: SideOutcome) -> SideResult:
            # score_for/against = games; metrics carries rally points for point-diff tie-breaks
            return SideResult(
                participant_id=ids[i],
                outcome=outcome,
                score_for=games_won[i],
                score_against=games_won[1 - i],
                metrics={"points_for": points_for[i], "points_against": points_for[1 - i]},
            )

        sides = (_side(winner, SideOutcome.WIN), _side(loser, SideOutcome.LOSS))
        statistics = {
            ids[i]: {
                "games_won": games_won[i],
                "games_lost": games_won[1 - i],
                "points_for": points_for[i],
                "points_against": points_for[1 - i],
            }
            for i in (0, 1)
        }
        return MatchReport(
            outcome=Outcome.winner(ids[winner]),
            sides=sides,
            terminal_reason=reason,
            statistics=statistics,
        )
