"""Competition-engine contract tests — pure, no DB, no framework.

Covers the two finalized schemas (source_refs, advancement), the error contracts,
the value objects, the format registry (extension point), and proves the six engine
Protocols are implementable + runtime-checkable.
"""

from __future__ import annotations

import dataclasses

import pytest

from app.engine import (
    AdvancementRequest,
    ByeRef,
    EngineError,
    EngineValidationError,
    FormatEngine,
    FormatKey,
    FormatRegistry,
    GenerateRequest,
    LoserOfRef,
    Outcome,
    OutcomeKind,
    ParticipantSideRef,
    SchemaValidator,
    SeedingMethod,
    SeedRef,
    StandingRow,
    StandingsEngine,
    StructurePlan,
    UnknownFormatError,
    WinnerOfRef,
    parse_advancement,
    parse_source_refs,
)

# ---- source_refs schema ----


def test_source_refs_parses_every_side_type():
    refs = parse_source_refs(
        {
            "sides": [
                {"seed": 1},
                {"participant": "p-123"},
                {"winner_of": "R1-M1"},
                {"loser_of": "R1-M2"},
                {"bye": True},
            ]
        }
    )
    assert refs.sides == (
        SeedRef(1),
        ParticipantSideRef("p-123"),
        WinnerOfRef("R1-M1"),
        LoserOfRef("R1-M2"),
        ByeRef(),
    )
    assert refs.referenced_matches() == frozenset({"R1-M1", "R1-M2"})


@pytest.mark.parametrize(
    "data",
    [
        {},  # no sides
        {"sides": []},  # empty
        {"sides": "nope"},  # not a list
        {"sides": [{}]},  # side with no key
        {"sides": [{"seed": 1, "bye": True}]},  # two keys
        {"sides": [{"seed": 0}]},  # non-positive seed
        {"sides": [{"seed": True}]},  # bool is not a valid seed
        {"sides": [{"winner_of": ""}]},  # empty ref
        {"sides": [{"bye": False}]},  # bye must be true
        {"sides": [{"unknown": 1}]},  # unknown key
    ],
)
def test_source_refs_rejects_invalid(data):
    with pytest.raises(EngineValidationError) as exc:
        parse_source_refs(data)
    assert len(exc.value.issues) >= 1
    assert all(i.path and i.code for i in exc.value.issues)


# ---- advancement schema ----


def test_advancement_parses_all_and_list_groups():
    rule = parse_advancement(
        {
            "sources": [
                {"stage": "groups", "groups": "all", "take": {"by": "rank", "range": [1, 2]}},
                {"stage": "groups", "groups": ["A", "B"], "take": {"by": "rank", "range": [3, 3]}},
            ],
            "seeding": "cross",
        }
    )
    assert rule.seeding is SeedingMethod.CROSS
    assert rule.sources[0].groups is None and rule.sources[1].groups == ("A", "B")
    assert rule.sources[0].take.lo == 1 and rule.sources[0].take.hi == 2


def test_advancement_random_requires_rng_seed():
    with pytest.raises(EngineValidationError) as exc:
        parse_advancement(
            {
                "sources": [{"stage": "g", "take": {"by": "rank", "range": [1, 1]}}],
                "seeding": "random",
            }
        )
    assert any(i.code == "required" and i.path == "rngSeed" for i in exc.value.issues)
    # …and is accepted with one.
    rule = parse_advancement(
        {
            "sources": [{"stage": "g", "take": {"by": "rank", "range": [1, 1]}}],
            "seeding": "random",
            "rngSeed": 7,
        }
    )
    assert rule.rng_seed == 7


@pytest.mark.parametrize(
    "data",
    [
        {"sources": [], "seeding": "cross"},  # empty sources
        {"sources": [{"stage": "g", "take": {"by": "rank", "range": [2, 1]}}], "seeding": "cross"},
        {"sources": [{"stage": "g", "take": {"by": "nope", "range": [1, 1]}}], "seeding": "cross"},
        {"sources": [{"stage": "g", "take": {"by": "rank", "range": [1, 1]}}], "seeding": "bogus"},
        {"sources": [{"take": {"by": "rank", "range": [1, 1]}}], "seeding": "cross"},  # no stage
    ],
)
def test_advancement_rejects_invalid(data):
    with pytest.raises(EngineValidationError):
        parse_advancement(data)


def test_parsers_are_deterministic():
    data = {
        "sources": [{"stage": "g", "take": {"by": "rank", "range": [1, 2]}}],
        "seeding": "as_is",
    }
    assert parse_advancement(data) == parse_advancement(data)


# ---- value objects ----


def test_outcome_constructors():
    assert Outcome.winner("p1").kind is OutcomeKind.WINNER
    assert Outcome.draw(("p1", "p2")).drawn_ids == ("p1", "p2")
    assert Outcome.ranked(("p1", "p2", "p3")).kind is OutcomeKind.RANKED


def test_standing_diff_and_immutability():
    row = StandingRow(participant_id="p1", score_for=21, score_against=15)
    assert row.diff == 6
    with pytest.raises(dataclasses.FrozenInstanceError):
        row.rank = 1  # type: ignore[misc]


# ---- validation engine ----


def test_schema_validator_delegates_and_checks_wiring():
    validator = SchemaValidator()
    assert validator.validate_source_refs({"sides": [{"seed": 1}]}).sides == (SeedRef(1),)
    assert (
        validator.validate_advancement(
            {
                "sources": [{"stage": "g", "take": {"by": "rank", "range": [1, 1]}}],
                "seeding": "as_is",
            }
        ).seeding
        is SeedingMethod.AS_IS
    )

    good = {
        "final": parse_source_refs({"sides": [{"winner_of": "semi1"}, {"winner_of": "semi2"}]}),
        "semi1": parse_source_refs({"sides": [{"seed": 1}, {"seed": 4}]}),
        "semi2": parse_source_refs({"sides": [{"seed": 2}, {"seed": 3}]}),
    }
    validator.validate_wiring(good)  # no raise

    with pytest.raises(EngineValidationError):
        validator.validate_wiring(
            {"final": parse_source_refs({"sides": [{"winner_of": "ghost"}, {"seed": 1}]})}
        )
    with pytest.raises(EngineValidationError):
        validator.validate_wiring(
            {"m": parse_source_refs({"sides": [{"winner_of": "m"}, {"seed": 1}]})}  # self-ref
        )


# ---- registry (extension point) ----


class _FakeFormat:
    key = FormatKey.ROUND_ROBIN

    def validate_config(self, config):
        return None

    def generate(self, request: GenerateRequest) -> StructurePlan:
        return StructurePlan(format=self.key)


class _FakeStandings:
    def compute(self, request):
        return ()


def test_registry_register_get_unknown_duplicate():
    registry = FormatRegistry()
    engine = _FakeFormat()
    registry.register(engine)
    assert registry.get(FormatKey.ROUND_ROBIN) is engine
    assert registry.is_registered(FormatKey.ROUND_ROBIN)
    assert registry.registered() == frozenset({FormatKey.ROUND_ROBIN})
    with pytest.raises(EngineError):
        registry.register(engine)  # duplicate
    with pytest.raises(UnknownFormatError):
        registry.get(FormatKey.SWISS)  # unregistered


def test_protocols_are_runtime_checkable():
    assert isinstance(_FakeFormat(), FormatEngine)
    assert isinstance(_FakeStandings(), StandingsEngine)
    assert not isinstance(object(), FormatEngine)


def test_engine_requests_are_immutable():
    req = AdvancementRequest(matches=(), seeds={1: "p1"}, winners={})
    with pytest.raises(dataclasses.FrozenInstanceError):
        req.seeds = {}  # type: ignore[misc]
