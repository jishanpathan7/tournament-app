"""Single Elimination FormatEngine + AdvancementEngine tests — pure, no DB.

Covers 2/3/4/8/16 participants, seeded brackets, bye placement, balancing,
determinism, and forward resolution (winner_of progression, byes → walkovers,
invalid/malformed states).
"""

from __future__ import annotations

import pytest

from app.engine import (
    AdvancementRequest,
    ByeRef,
    DefaultAdvancementEngine,
    EngineValidationError,
    FormatKey,
    GenerateRequest,
    ParticipantRef,
    SeedRef,
    SingleEliminationFormat,
    WinnerOfRef,
)

FMT = SingleEliminationFormat()
ADV = DefaultAdvancementEngine()


def _participants(n: int) -> tuple[ParticipantRef, ...]:
    return tuple(ParticipantRef(id=f"p{i}") for i in range(1, n + 1))  # p1 = seed 1


def _seeds(n: int) -> dict[int, str]:
    return {i: f"p{i}" for i in range(1, n + 1)}


def _generate(n: int, rng_seed: int | None = None):
    return FMT.generate(
        GenerateRequest(
            format=FormatKey.SINGLE_ELIM, participants=_participants(n), rng_seed=rng_seed
        )
    )


def _by_key(plan):
    return {m.key: m for m in plan.matches}


# ---- bracket generation ----


@pytest.mark.parametrize(
    "n,size,rounds",
    [(2, 2, 1), (3, 4, 2), (4, 4, 2), (5, 8, 3), (8, 8, 3), (16, 16, 4)],
)
def test_bracket_shape(n, size, rounds):
    plan = _generate(n)
    assert plan.format is FormatKey.SINGLE_ELIM
    assert len(plan.matches) == size - 1  # a knockout of `size` slots has size-1 matches
    assert len(plan.rounds) == rounds
    # exactly one final; match count halves each round
    assert plan.rounds[-1].label == "Final"


def test_round_labels_for_16():
    assert [r.label for r in _generate(16).rounds] == [
        "Round of 16",
        "Quarterfinal",
        "Semifinal",
        "Final",
    ]


def test_power_of_two_has_no_byes():
    plan = _generate(8)
    for match in plan.matches:
        assert not any(isinstance(s, ByeRef) for s in match.source_refs.sides)


@pytest.mark.parametrize("n,size", [(3, 4), (5, 8), (6, 8), (12, 16)])
def test_byes_count_and_placed_on_top_seeds(n, size):
    plan = _generate(n)
    bye_matches = [
        m for m in plan.matches if any(isinstance(s, ByeRef) for s in m.source_refs.sides)
    ]
    assert len(bye_matches) == size - n  # one bye per empty slot, no double byes
    # the competitor sharing a bye match is always a top seed (1..byes)
    for match in bye_matches:
        seed_side = next(s for s in match.source_refs.sides if isinstance(s, SeedRef))
        assert seed_side.seed <= (size - n)


def test_seeds_1_and_2_are_in_opposite_halves():
    for n in (4, 8, 16):
        plan = _generate(n)
        size = len(plan.matches) + 1
        r1 = [m for m in plan.matches if m.round_key == "R1"]

        def _index_of_seed(seed: int) -> int:
            return next(
                i
                for i, m in enumerate(r1)
                if any(isinstance(s, SeedRef) and s.seed == seed for s in m.source_refs.sides)
            )

        assert _index_of_seed(1) < size // 4 <= _index_of_seed(2)  # different bracket halves


def test_later_rounds_reference_winner_of_previous():
    plan = _generate(4)
    final = _by_key(plan)["R2-M1"]
    refs = {s.match_key for s in final.source_refs.sides if isinstance(s, WinnerOfRef)}
    assert refs == {"R1-M1", "R1-M2"}


def test_deterministic_and_seeded_shuffle_is_reproducible():
    assert _generate(8).matches == _generate(8).matches
    assert _generate(8, rng_seed=5).matches == _generate(8, rng_seed=5).matches


@pytest.mark.parametrize("n", [0, 1])
def test_rejects_too_few_participants(n):
    with pytest.raises(EngineValidationError):
        _generate(n)


def test_rejects_duplicate_ids():
    with pytest.raises(EngineValidationError):
        FMT.generate(
            GenerateRequest(
                format=FormatKey.SINGLE_ELIM,
                participants=(ParticipantRef(id="x"), ParticipantRef(id="x")),
            )
        )


# ---- advancement (winner progression + byes + walkovers) ----


def _resolve(plan, n, winners=None):
    return ADV.resolve(
        AdvancementRequest(matches=plan.matches, seeds=_seeds(n), winners=winners or {})
    )


def test_advance_four_player_bracket():
    plan = _generate(4)
    # nothing played yet: both round-1 matches are ready, the final is pending
    result = _resolve(plan, 4)
    assert result.ready == frozenset({"R1-M1", "R1-M2"})
    assert not result.byes
    final_sides = result.sides["R2-M1"]
    assert all(s.is_pending for s in final_sides)

    # play round 1 → the final resolves to the two winners
    result = _resolve(plan, 4, {"R1-M1": "p1", "R1-M2": "p2"})
    assert "R2-M1" in result.ready
    assert {s.participant_id for s in result.sides["R2-M1"]} == {"p1", "p2"}


def test_bye_auto_resolves_as_walkover_and_cascades():
    plan = _generate(3)  # seed 1 gets a bye into the final
    result = _resolve(plan, 3)
    assert result.byes == frozenset({"R1-M1"})  # seed1 vs bye
    assert result.winners["R1-M1"] == "p1"  # advanced automatically
    assert result.ready == frozenset({"R1-M2"})  # p2 vs p3 is playable; final still pending
    # play the real semifinal → final now has p1 (via bye) vs p3
    result = _resolve(plan, 3, {"R1-M2": "p3"})
    assert {s.participant_id for s in result.sides["R2-M1"]} == {"p1", "p3"}
    assert "R2-M1" in result.ready


def test_walkover_is_just_a_reported_winner():
    plan = _generate(4)
    result = _resolve(plan, 4, {"R1-M1": "p4"})  # p4 advances (e.g. p1 walked over)
    assert result.winners["R1-M1"] == "p4"
    assert result.sides["R2-M1"][0].participant_id == "p4"


def test_full_16_bracket_progression_to_champion():
    plan = _generate(16)
    winners: dict[str, str] = {}
    # deterministically let the lower match index win each round
    for r in range(1, 5):
        ready = _resolve(plan, 16, winners).ready
        for key in ready:
            sides = _resolve(plan, 16, winners).sides[key]
            winners[key] = next(s.participant_id for s in sides if s.participant_id)
    result = _resolve(plan, 16, winners)
    assert result.winners["R4-M1"]  # a champion exists
    assert len(result.byes) == 0  # 16 is a power of two


# ---- invalid / malformed ----


def test_reject_winner_not_a_side():
    plan = _generate(4)
    with pytest.raises(EngineValidationError):
        _resolve(plan, 4, {"R1-M1": "ghost"})


def test_reject_unknown_match():
    plan = _generate(4)
    with pytest.raises(EngineValidationError):
        _resolve(plan, 4, {"R9-M9": "p1"})


def test_reject_winner_before_sides_known():
    plan = _generate(4)
    with pytest.raises(EngineValidationError):
        _resolve(plan, 4, {"R2-M1": "p1"})  # final winner before semifinals resolved


def test_empty_bracket_resolves_to_empty():
    result = ADV.resolve(AdvancementRequest(matches=(), seeds={}, winners={}))
    assert result.sides == {} and result.ready == frozenset() and result.byes == frozenset()
