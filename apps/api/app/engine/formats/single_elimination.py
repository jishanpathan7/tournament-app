"""Single Elimination ``FormatEngine`` — the reference elimination format.

Generates a full, seeded, balanced knockout bracket sized to the next power of two.
Seeding uses the standard bracket order (1 vs lowest, top seeds spread so 1 and 2 can
only meet in the final). Empty slots become **byes** placed on the top seeds. Every
slot flows through a match: round 1 sides are ``seed``/``bye`` refs, later rounds are
``winner_of`` refs — so the whole bracket is materialised up front and resolved forward
by the ``AdvancementEngine`` (bye → walkover, winner_of → next round).

Pure + deterministic: fixtures depend only on the (seeded) participant order, unless an
``rng_seed`` is given, which reproducibly shuffles into a random draw. Sport-agnostic.
"""

from __future__ import annotations

import random
from collections.abc import Mapping
from typing import Any

from app.engine.contracts import GenerateRequest
from app.engine.errors import EngineValidationError, Issue
from app.engine.source_refs import ByeRef, SeedRef, SideRef, SourceRefs, WinnerOfRef
from app.engine.types import FormatKey, MatchPlan, RoundPlan, StructurePlan


def _next_power_of_two(n: int) -> int:
    return 1 << (n - 1).bit_length()


def _seed_slot_order(size: int) -> list[int]:
    """Standard bracket seeding order for a power-of-two ``size`` (e.g. 4 → [1,4,2,3])."""
    order = [1]
    while len(order) < size:
        pool = len(order) * 2
        order = [x for s in order for x in (s, pool + 1 - s)]
    return order


def _round_label(matches_in_round: int) -> str:
    return {1: "Final", 2: "Semifinal", 4: "Quarterfinal"}.get(
        matches_in_round, f"Round of {matches_in_round * 2}"
    )


class SingleEliminationFormat:
    """Satisfies ``app.engine.FormatEngine`` for ``FormatKey.SINGLE_ELIM``."""

    key = FormatKey.SINGLE_ELIM

    def validate_config(self, config: Mapping[str, Any]) -> None:
        return None  # no required config; third-place/consolation is a future extension

    def generate(self, request: GenerateRequest) -> StructurePlan:
        self.validate_config(request.config)
        ids = [p.id for p in request.participants]

        issues: list[Issue] = []
        if len(ids) < 2:
            issues.append(Issue("participants", "too_few", "single elimination needs at least 2"))
        if len(set(ids)) != len(ids):
            issues.append(Issue("participants", "duplicate", "participant ids must be unique"))
        if issues:
            raise EngineValidationError(issues)

        if request.rng_seed is not None:
            ids = list(ids)
            random.Random(request.rng_seed).shuffle(ids)

        n = len(ids)
        size = _next_power_of_two(n)  # slots; byes = size - n on the top seeds
        slot_order = _seed_slot_order(size)
        num_rounds = size.bit_length() - 1

        matches: list[MatchPlan] = []
        rounds: list[RoundPlan] = []

        # Round 1: pair adjacent slots; seed# > n is a bye.
        def _side(seed_number: int) -> SideRef:
            return SeedRef(seed_number) if seed_number <= n else ByeRef()

        for i in range(size // 2):
            a, b = slot_order[2 * i], slot_order[2 * i + 1]
            matches.append(
                MatchPlan(
                    key=f"R1-M{i + 1}",
                    source_refs=SourceRefs((_side(a), _side(b))),
                    round_key="R1",
                )
            )

        # Rounds 2..final: each match is fed by two matches of the previous round.
        prev_count = size // 2
        for r in range(2, num_rounds + 1):
            count = prev_count // 2
            for i in range(count):
                feed_a = f"R{r - 1}-M{2 * i + 1}"
                feed_b = f"R{r - 1}-M{2 * i + 2}"
                matches.append(
                    MatchPlan(
                        key=f"R{r}-M{i + 1}",
                        source_refs=SourceRefs((WinnerOfRef(feed_a), WinnerOfRef(feed_b))),
                        round_key=f"R{r}",
                    )
                )
            prev_count = count

        for r in range(1, num_rounds + 1):
            matches_in_round = size // (2**r)
            rounds.append(RoundPlan(key=f"R{r}", seq=r, label=_round_label(matches_in_round)))

        return StructurePlan(format=self.key, rounds=tuple(rounds), matches=tuple(matches))
