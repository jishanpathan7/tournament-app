"""FoldPairingEngine tests — pure, no DB.

Covers determinism/reproducibility, skill balancing toward a target, confidence +
strength scoring, preferred partners, forced overrides, forbidden pairs, cross-round
repeat avoidance, odd reserves, seeded tie-breaks, and team_size > 2 (snake).
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.engine import (
    EngineValidationError,
    FoldPairingEngine,
    PairingConstraints,
    PairingEntrant,
    PairingPolicy,
    TeamFormationRequest,
)

ENGINE = FoldPairingEngine()
DOUBLES = PairingPolicy(team_size=2, target_strength=Decimal(4))


def E(eid: str, weight: int, pref: str | None = None) -> PairingEntrant:
    return PairingEntrant(
        id=eid, weight=Decimal(weight), display_name=eid, preferred_partner_id=pref
    )


def _form(entrants, policy=DOUBLES, constraints=None, rng_seed=None):
    return ENGINE.form_teams(
        TeamFormationRequest(
            entrants=tuple(entrants),
            policy=policy,
            constraints=constraints or PairingConstraints(),
            rng_seed=rng_seed,
        )
    )


def _members(plan):
    return {frozenset(t.member_ids) for t in plan.teams}


# ---- balancing ----


def test_fold_pairs_strongest_with_weakest_toward_target():
    plan = _form([E("a", 3), E("b", 3), E("c", 2), E("d", 2), E("e", 1), E("f", 1)])
    # Every team should reach the target strength of 4.
    assert all(t.strength == Decimal(4) for t in plan.teams)
    assert all(t.confidence == Decimal("1.00") for t in plan.teams)
    assert _members(plan) == {frozenset({"a", "e"}), frozenset({"b", "f"}), frozenset({"c", "d"})}
    assert plan.unpaired == ()


def test_confidence_drops_for_imbalanced_teams():
    # Two 3s and two 1s: fold pairs 3+1 / 3+1 (balanced). Force imbalance via forbidden
    # so a 3+3 and 1+1 must form, and check confidence reflects the deviation.
    plan = _form(
        [E("a", 3), E("b", 3), E("c", 1), E("d", 1)],
        constraints=PairingConstraints(forbidden_pairs=(("a", "c"), ("a", "d"))),
    )
    by_members = {frozenset(t.member_ids): t for t in plan.teams}
    strong = by_members[frozenset({"a", "b"})]
    weak = by_members[frozenset({"c", "d"})]
    assert strong.strength == Decimal(6) and weak.strength == Decimal(2)
    # Target 4, field max deviation = |6-4| = 2 ⇒ confidence 1 - 2/2 = 0.
    assert strong.confidence == Decimal("0.00")
    assert weak.confidence == Decimal("0.00")


def test_target_defaults_to_field_mean_when_policy_has_none():
    policy = PairingPolicy(team_size=2, target_strength=None)
    plan = _form([E("a", 3), E("b", 1), E("c", 2), E("d", 2)], policy=policy)
    # Mean weight 2 ⇒ target team strength 4; balanced pairing reaches it.
    assert all(t.strength == Decimal(4) for t in plan.teams)


# ---- determinism / reproducibility ----


def test_no_seed_is_fully_deterministic():
    entrants = [E("a", 2), E("b", 2), E("c", 2), E("d", 2)]
    first = _form(entrants)
    second = _form(entrants)
    assert _members(first) == _members(second)
    assert [t.member_ids for t in first.teams] == [t.member_ids for t in second.teams]


def test_same_seed_reproduces_same_result():
    entrants = [E(chr(97 + i), 2) for i in range(8)]  # all equal weight ⇒ ties matter
    a = _form(entrants, rng_seed=42)
    b = _form(entrants, rng_seed=42)
    assert [t.member_ids for t in a.teams] == [t.member_ids for t in b.teams]


def test_different_seeds_can_differ_on_ties():
    entrants = [E(chr(97 + i), 2) for i in range(8)]
    a = _form(entrants, rng_seed=1)
    b = _form(entrants, rng_seed=999)
    # Not guaranteed different, but the pairing must stay valid (4 teams, all placed).
    for plan in (a, b):
        assert len(plan.teams) == 4
        assert plan.unpaired == ()


# ---- preferences ----


def test_mutual_preference_is_honored():
    plan = _form(
        [E("a", 3, pref="f"), E("b", 3), E("c", 2), E("d", 2), E("e", 1), E("f", 1, pref="a")]
    )
    teams = _members(plan)
    assert frozenset({"a", "f"}) in teams
    pref_team = next(t for t in plan.teams if set(t.member_ids) == {"a", "f"})
    assert pref_team.forced is True
    assert "Requested partners" in pref_team.reasons


def test_unrequited_preference_honored_when_partner_uncontested():
    plan = _form([E("a", 3, pref="b"), E("b", 2), E("c", 2), E("d", 1)])
    assert frozenset({"a", "b"}) in _members(plan)


def test_preference_ignored_when_partner_wants_someone_else():
    # a wants b, but b wants c ⇒ a's preference is not honored; b+c pair.
    plan = _form([E("a", 3, pref="b"), E("b", 2, pref="c"), E("c", 2, pref="b"), E("d", 1)])
    assert frozenset({"b", "c"}) in _members(plan)
    assert frozenset({"a", "b"}) not in _members(plan)


# ---- forced overrides ----


def test_forced_group_is_formed_verbatim():
    plan = _form(
        [E("a", 3), E("b", 1), E("c", 2), E("d", 2)],
        constraints=PairingConstraints(forced_groups=(("a", "b"),)),
    )
    forced = next(t for t in plan.teams if set(t.member_ids) == {"a", "b"})
    assert forced.forced is True
    assert "Locked by organizer" in forced.reasons
    assert frozenset({"c", "d"}) in _members(plan)


def test_forced_group_wrong_size_raises():
    with pytest.raises(EngineValidationError):
        _form(
            [E("a", 3), E("b", 1), E("c", 2)],
            constraints=PairingConstraints(forced_groups=(("a", "b", "c"),)),
        )


# ---- forbidden + repeats ----


def test_forbidden_pair_is_never_formed():
    plan = _form(
        [E("a", 3), E("b", 3), E("c", 1), E("d", 1)],
        constraints=PairingConstraints(forbidden_pairs=(("a", "c"),)),
    )
    assert frozenset({"a", "c"}) not in _members(plan)


def test_avoids_repeat_pairings_when_possible():
    # a previously partnered e; a fresh alternative (another weakest) exists.
    plan = _form(
        [E("a", 3), E("b", 3), E("c", 1), E("d", 1)],
        constraints=PairingConstraints(prior_pairings=(("a", "c"),), avoid_repeats=True),
    )
    # a should avoid c and take the other weakest, d.
    assert frozenset({"a", "d"}) in _members(plan)
    assert frozenset({"a", "c"}) not in _members(plan)


def test_falls_back_to_repeat_when_unavoidable_and_notes_it():
    # Only one possible partner for a (b), and it's a prior pairing.
    plan = _form(
        [E("a", 3), E("b", 1)],
        constraints=PairingConstraints(prior_pairings=(("a", "b"),), avoid_repeats=True),
    )
    assert frozenset({"a", "b"}) in _members(plan)
    team = plan.teams[0]
    assert any("Repeat pairing" in r for r in team.reasons)


# ---- odd counts + validation ----


def test_odd_count_leaves_one_reserve():
    plan = _form([E("a", 3), E("b", 2), E("c", 1)])
    assert len(plan.teams) == 1
    assert len(plan.unpaired) == 1


def test_duplicate_ids_raise():
    with pytest.raises(EngineValidationError):
        _form([E("a", 3), E("a", 1)])


def test_too_few_entrants_raise():
    with pytest.raises(EngineValidationError):
        _form([E("a", 3)])


def test_unsupported_policy_raises():
    with pytest.raises(EngineValidationError):
        _form([E("a", 3), E("b", 1)], policy=PairingPolicy(team_size=1))


# ---- team_size > 2 (snake) ----


def test_snake_draft_balances_larger_teams():
    entrants = [E(chr(97 + i), (6 - i)) for i in range(6)]  # weights 6..1
    plan = _form(entrants, policy=PairingPolicy(team_size=3, target_strength=None))
    assert len(plan.teams) == 2
    strengths = sorted(t.strength for t in plan.teams)
    # Snake deal of 6,5,4,3,2,1 → teams {6,3,2}=11 and {5,4,1}... balanced within 1.
    assert strengths[1] - strengths[0] <= Decimal(1)


def test_seed_echoed_in_plan():
    plan = _form([E("a", 2), E("b", 2)], rng_seed=7)
    assert plan.rng_seed == 7
