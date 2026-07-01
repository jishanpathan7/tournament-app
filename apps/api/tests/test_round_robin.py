"""Round Robin FormatEngine tests — pure, no DB.

Covers 2..8 participants, bye generation (odd counts), balanced/deterministic
fixtures, duplicate prevention, double round robin, and validation.
"""

from __future__ import annotations

from collections import Counter

import pytest

from app.engine import (
    EngineValidationError,
    FormatKey,
    GenerateRequest,
    ParticipantRef,
    RoundRobinFormat,
)
from app.engine.source_refs import ParticipantSideRef

FMT = RoundRobinFormat()


def _participants(n: int) -> tuple[ParticipantRef, ...]:
    return tuple(ParticipantRef(id=f"p{i}") for i in range(n))


def _generate(n: int, config: dict | None = None, rng_seed: int | None = None):
    return FMT.generate(
        GenerateRequest(
            format=FormatKey.ROUND_ROBIN,
            participants=_participants(n),
            config=config or {},
            rng_seed=rng_seed,
        )
    )


def _unordered_pairs(plan) -> list[tuple[str, str]]:
    pairs = []
    for match in plan.matches:
        ids = tuple(sorted(s.participant_id for s in match.source_refs.sides))
        assert all(isinstance(s, ParticipantSideRef) for s in match.source_refs.sides)  # no byes
        pairs.append(ids)
    return pairs


@pytest.mark.parametrize("n", [2, 3, 4, 5, 6, 7, 8])
def test_single_round_robin_is_complete_and_unique(n):
    plan = _generate(n)
    pairs = _unordered_pairs(plan)
    # every unordered pair appears exactly once
    assert len(pairs) == n * (n - 1) // 2
    assert len(set(pairs)) == len(pairs)  # duplicate prevention
    # each participant plays every other exactly once → n-1 matches
    plays = Counter(pid for pair in pairs for pid in pair)
    assert set(plays.values()) == {n - 1}


@pytest.mark.parametrize("n,expected_rounds", [(2, 1), (3, 3), (4, 3), (5, 5), (6, 5), (7, 7)])
def test_round_count_and_no_double_booking_per_round(n, expected_rounds):
    plan = _generate(n)
    assert len(plan.rounds) == expected_rounds
    # within any round a participant appears at most once (balanced schedule)
    by_round: dict[str, list[str]] = {}
    for match in plan.matches:
        for side in match.source_refs.sides:
            by_round.setdefault(match.round_key, []).append(side.participant_id)
    for _round_key, players in by_round.items():
        assert len(players) == len(set(players))


def test_odd_count_generates_byes_not_matches():
    # 5 players → each round one player rests; 2 matches/round, 5 rounds = 10 matches
    plan = _generate(5)
    assert len(plan.matches) == 10
    per_round = Counter(m.round_key for m in plan.matches)
    assert set(per_round.values()) == {2}  # never 2.5 — the bye is simply not scheduled


def test_two_participants_single_match():
    plan = _generate(2)
    assert len(plan.matches) == 1 and len(plan.rounds) == 1
    assert _unordered_pairs(plan) == [("p0", "p1")]
    assert plan.groups[0].participant_ids == ("p0", "p1")


def test_deterministic_without_seed():
    assert _generate(6).matches == _generate(6).matches


def test_rng_seed_is_deterministic_and_still_complete():
    a = _generate(6, rng_seed=42)
    b = _generate(6, rng_seed=42)
    assert a.matches == b.matches  # same seed ⇒ identical fixtures
    pairs = _unordered_pairs(a)
    assert len(set(pairs)) == 6 * 5 // 2  # still a complete round robin


def test_double_round_robin_plays_each_pair_twice():
    plan = _generate(4, config={"cycles": 2})
    pairs = _unordered_pairs(plan)
    assert len(pairs) == 2 * (4 * 3 // 2)
    assert set(Counter(pairs).values()) == {2}
    assert len(plan.rounds) == 2 * 3


@pytest.mark.parametrize("n", [0, 1])
def test_rejects_too_few_participants(n):
    with pytest.raises(EngineValidationError):
        _generate(n)


def test_rejects_duplicate_participant_ids():
    request = GenerateRequest(
        format=FormatKey.ROUND_ROBIN,
        participants=(ParticipantRef(id="x"), ParticipantRef(id="x")),
        config={},
    )
    with pytest.raises(EngineValidationError):
        FMT.generate(request)


@pytest.mark.parametrize("cycles", [0, -1, "two", 1.5])
def test_rejects_invalid_cycles(cycles):
    with pytest.raises(EngineValidationError):
        FMT.validate_config({"cycles": cycles})
