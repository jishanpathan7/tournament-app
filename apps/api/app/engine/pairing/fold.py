"""Fold pairing — the reference ``TeamFormationEngine``.

Combines solo entrants into balanced teams. Sport-agnostic: it reads only the numeric
``PairingEntrant.weight`` and the ``PairingPolicy`` the Sport Profile supplies — it never
sees a skill *label*.

Algorithm (the doubles / ``team_size == 2`` path, which is the primary case):

  1. **Forced groups** (hard organizer overrides) become teams first, verbatim.
  2. **Preferences** — a mutual (or unrequited-but-uncontested) ``preferred_partner_id``
     forms a team next; an explicit preference is honored even across a prior pairing.
  3. **Balance (fold)** — of the rest, repeatedly take the strongest unpaired entrant and
     match it with the partner that brings the team's aggregate weight closest to the
     ``target_strength`` (for the classic "strongest + weakest inward" fold, that *is* the
     weakest). Forbidden pairs are never formed; prior pairings are avoided when
     ``avoid_repeats`` is set, falling back to a repeat only when nothing else is possible.
  4. An odd entrant left over is returned as ``unpaired`` (the reserve).

``team_size > 2`` uses a serpentine (snake) draft into ``ceil(n / team_size)`` teams —
strength-balanced, forced groups honored, preferences not applied (team sports don't
model a single "partner").

Deterministic + reproducible: ordering is ``(weight desc, id asc)``; with an ``rng_seed``
the pool is shuffled reproducibly before the stable weight-sort, so equal-weight ties are
seed-driven while the fold structure is preserved. No wall clock, no ambient randomness.
"""

from __future__ import annotations

import random
from decimal import Decimal
from typing import TYPE_CHECKING

from app.engine.errors import EngineValidationError, Issue
from app.engine.types import (
    EntrantId,
    PairingEntrant,
    PairingPolicy,
    PairingStrategy,
    TeamFormationPlan,
    TeamProposal,
)

if TYPE_CHECKING:
    from app.engine.contracts import TeamFormationRequest

_CONF_QUANT = Decimal("0.01")


def field_max_dev(weights: list[Decimal], team_size: int, target: Decimal) -> Decimal:
    """The largest a team's strength could deviate from ``target`` given the field's
    weight range — the normalizer for confidence. 0 when every entrant is equal."""
    if not weights:
        return Decimal(0)
    lo = min(weights) * Decimal(team_size)
    hi = max(weights) * Decimal(team_size)
    return max(abs(lo - target), abs(hi - target))


def pairing_confidence(strength: Decimal, target: Decimal, max_dev: Decimal) -> Decimal:
    """A 0..1 balance score: 1.0 exactly on target, 0.0 at the worst-possible deviation.
    Shared by the engine and the service's re-score-after-edit path (one source of truth)."""
    if max_dev == 0:
        return Decimal(1)
    raw = Decimal(1) - abs(strength - target) / max_dev
    return min(Decimal(1), max(Decimal(0), raw)).quantize(_CONF_QUANT)


class _RawTeam:
    """A formed team before scoring: members + why it was formed."""

    __slots__ = ("member_ids", "origin", "notes")

    def __init__(self, member_ids: list[EntrantId], origin: str, notes: list[str] | None = None):
        self.member_ids = member_ids
        self.origin = origin  # "forced" | "preference" | "balanced"
        self.notes = notes or []


class FoldPairingEngine:
    """Satisfies ``app.engine.TeamFormationEngine``."""

    def form_teams(self, request: "TeamFormationRequest") -> TeamFormationPlan:
        policy = request.policy
        if not policy.supports_pairing:
            raise EngineValidationError(
                [Issue("policy", "unsupported", "this sport does not support team formation")]
            )

        entrants = list(request.entrants)
        self._validate(entrants, policy)
        by_id: dict[EntrantId, PairingEntrant] = {e.id: e for e in entrants}
        constraints = request.constraints

        # Deterministic base order: weight desc, id asc. A seed shuffles first so that
        # equal-weight ties resolve reproducibly by seed rather than always by id.
        order = list(entrants)
        if request.rng_seed is not None:
            random.Random(request.rng_seed).shuffle(order)
        order.sort(key=lambda e: (-e.weight, e.id) if request.rng_seed is None else -e.weight)
        pool_ids = [e.id for e in order]

        raw: list[_RawTeam] = []
        forbidden = _forbidden_set(constraints.forbidden_pairs)
        prior = _forbidden_set(constraints.prior_pairings) if constraints.avoid_repeats else set()

        # 1. forced groups (hard overrides) — verbatim, removed from the pool.
        raw.extend(self._take_forced(constraints.forced_groups, pool_ids, policy))

        # 2. preferences (team_size == 2 only).
        if policy.team_size == 2:
            raw.extend(self._take_preferences(pool_ids, by_id, forbidden))

        # 3. balance the remainder.
        target = self._target(entrants, policy)
        if policy.team_size == 2:
            formed, unpaired = self._fold(pool_ids, by_id, target, forbidden, prior)
        else:
            formed, unpaired = self._snake(pool_ids, policy.team_size)
        raw.extend(formed)

        stats = _FieldStats.of(entrants, policy, target)
        teams = tuple(
            self._score(f"T{i + 1}", team, by_id, policy, target, stats)
            for i, team in enumerate(raw)
        )
        return TeamFormationPlan(teams=teams, unpaired=tuple(unpaired), rng_seed=request.rng_seed)

    # ---- validation ----

    @staticmethod
    def _validate(entrants: list[PairingEntrant], policy: PairingPolicy) -> None:
        issues: list[Issue] = []
        ids = [e.id for e in entrants]
        if len(set(ids)) != len(ids):
            issues.append(Issue("entrants", "duplicate", "entrant ids must be unique"))
        if len(entrants) < policy.team_size:
            issues.append(
                Issue(
                    "entrants",
                    "too_few",
                    f"need at least {policy.team_size} entrants to form a team",
                )
            )
        if issues:
            raise EngineValidationError(issues)

    # ---- phase 1: forced groups ----

    def _take_forced(
        self,
        groups: tuple[tuple[EntrantId, ...], ...],
        pool_ids: list[EntrantId],
        policy: PairingPolicy,
    ) -> list[_RawTeam]:
        teams: list[_RawTeam] = []
        available = set(pool_ids)
        for group in groups:
            members = list(group)
            issues: list[Issue] = []
            if len(members) != policy.team_size:
                issues.append(
                    Issue(
                        "forced_groups",
                        "size",
                        f"a forced team needs exactly {policy.team_size} members",
                    )
                )
            for mid in members:
                if mid not in available:
                    issues.append(
                        Issue("forced_groups", "unknown", f"{mid!r} is unknown or already placed")
                    )
            if issues:
                raise EngineValidationError(issues)
            for mid in members:
                available.discard(mid)
                pool_ids.remove(mid)
            teams.append(_RawTeam(members, "forced", ["Locked by organizer"]))
        return teams

    # ---- phase 2: preferences ----

    def _take_preferences(
        self,
        pool_ids: list[EntrantId],
        by_id: dict[EntrantId, PairingEntrant],
        forbidden: set[frozenset[EntrantId]],
    ) -> list[_RawTeam]:
        teams: list[_RawTeam] = []
        available = set(pool_ids)
        # Process in the pool's (weight-desc) order for determinism.
        for eid in list(pool_ids):
            if eid not in available:
                continue
            pref = by_id[eid].preferred_partner_id
            if pref is None or pref not in available or pref == eid:
                continue
            if frozenset((eid, pref)) in forbidden:
                continue
            other_pref = by_id[pref].preferred_partner_id
            # Honor when mutual, or when the requested partner has no competing preference.
            if other_pref not in (eid, None):
                continue
            for mid in (eid, pref):
                available.discard(mid)
                pool_ids.remove(mid)
            teams.append(_RawTeam([eid, pref], "preference", ["Requested partners"]))
        return teams

    # ---- phase 3a: fold (team_size == 2) ----

    def _fold(
        self,
        pool_ids: list[EntrantId],
        by_id: dict[EntrantId, PairingEntrant],
        target: Decimal,
        forbidden: set[frozenset[EntrantId]],
        prior: set[frozenset[EntrantId]],
    ) -> tuple[list[_RawTeam], list[EntrantId]]:
        remaining = list(pool_ids)  # already weight-desc
        teams: list[_RawTeam] = []
        unpaired: list[EntrantId] = []

        while len(remaining) >= 2:
            a = remaining.pop(0)
            wa = by_id[a].weight
            best: EntrantId | None = None
            best_key: tuple[int, Decimal, EntrantId] | None = None
            for b in remaining:
                if frozenset((a, b)) in forbidden:
                    continue
                dev = abs(wa + by_id[b].weight - target)
                repeat = 1 if frozenset((a, b)) in prior else 0  # prefer non-repeats
                key = (repeat, dev, b)
                if best_key is None or key < best_key:
                    best_key, best = key, b
            if best is None:  # every remaining partner is forbidden
                unpaired.append(a)
                continue
            remaining.remove(best)
            notes = ["Strongest + weakest paired to balance strength"]
            if best_key is not None and best_key[0] == 1:
                notes.append("Repeat pairing — no fresh partner available")
            teams.append(_RawTeam([a, best], "balanced", notes))

        unpaired.extend(remaining)  # the odd one out (reserve)
        return teams, unpaired

    # ---- phase 3b: snake draft (team_size > 2) ----

    def _snake(
        self, pool_ids: list[EntrantId], team_size: int
    ) -> tuple[list[_RawTeam], list[EntrantId]]:
        n_full = len(pool_ids) // team_size
        if n_full == 0:
            return [], list(pool_ids)
        buckets: list[list[EntrantId]] = [[] for _ in range(n_full)]
        # Serpentine deal over the full teams only; the tail becomes reserves.
        forward = True
        idx = 0
        placed = 0
        capacity = n_full * team_size
        for eid in pool_ids[:capacity]:
            buckets[idx].append(eid)
            placed += 1
            if forward:
                idx += 1
                if idx == n_full:
                    idx, forward = n_full - 1, False
            else:
                idx -= 1
                if idx < 0:
                    idx, forward = 0, True
        teams = [_RawTeam(b, "balanced", ["Snake draft to balance team strength"]) for b in buckets]
        return teams, list(pool_ids[capacity:])

    # ---- scoring ----

    def _target(self, entrants: list[PairingEntrant], policy: PairingPolicy) -> Decimal:
        if policy.target_strength is not None:
            return policy.target_strength
        total = sum((e.weight for e in entrants), Decimal(0))
        mean = total / Decimal(len(entrants)) if entrants else Decimal(0)
        return mean * Decimal(policy.team_size)

    def _score(
        self,
        key: str,
        team: _RawTeam,
        by_id: dict[EntrantId, PairingEntrant],
        policy: PairingPolicy,
        target: Decimal,
        stats: "_FieldStats",
    ) -> TeamProposal:
        strength = sum((by_id[m].weight for m in team.member_ids), Decimal(0))
        confidence = stats.confidence(strength)
        reasons = list(team.notes)
        if policy.strategy is PairingStrategy.BALANCE:
            reasons.append(f"Team strength {_fmt(strength)} vs target {_fmt(target)}")
        return TeamProposal(
            key=key,
            member_ids=tuple(team.member_ids),
            strength=strength,
            confidence=confidence,
            reasons=tuple(reasons),
            forced=team.origin in ("forced", "preference"),
        )


class _FieldStats:
    """Field-wide bounds used to normalize a team's balance into a 0..1 confidence."""

    def __init__(self, target: Decimal, max_dev: Decimal):
        self.target = target
        self.max_dev = max_dev

    @classmethod
    def of(
        cls, entrants: list[PairingEntrant], policy: PairingPolicy, target: Decimal
    ) -> "_FieldStats":
        max_dev = field_max_dev([e.weight for e in entrants], policy.team_size, target)
        return cls(target, max_dev)

    def confidence(self, strength: Decimal) -> Decimal:
        return pairing_confidence(strength, self.target, self.max_dev)


def _forbidden_set(pairs: tuple[tuple[EntrantId, EntrantId], ...]) -> set[frozenset[EntrantId]]:
    return {frozenset(pair) for pair in pairs if len(set(pair)) == 2}


def _fmt(value: Decimal) -> str:
    normalized = value.normalize()
    return f"{normalized:f}"
