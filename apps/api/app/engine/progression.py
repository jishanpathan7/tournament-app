"""Default ``AdvancementEngine`` — resolves a bracket forward from seeds + winners.

Pure + deterministic + sport-agnostic. Given the bracket's matches (each carrying
``source_refs``), the seed→participant map, and the winners of completed matches, it:
- resolves every match's sides (participant / bye / pending),
- derives **bye walkovers** (a side facing a bye advances automatically) and cascades
  them forward (fixpoint), so downstream ``winner_of`` refs resolve,
- reports which matches are **ready** to play (all sides known),
- **rejects invalid states** (a reported winner that isn't a side of its match, or a
  winner for an unknown match).

``loser_of`` sides remain pending here (single elimination never uses them); double
elimination will supply a losers map — a forward-compatible extension, not a rewrite.
"""

from __future__ import annotations

from collections.abc import Mapping

from app.engine.contracts import AdvancementRequest
from app.engine.errors import EngineValidationError, Issue
from app.engine.source_refs import (
    ByeRef,
    LoserOfRef,
    ParticipantSideRef,
    SeedRef,
    WinnerOfRef,
)
from app.engine.types import (
    AdvancementResult,
    MatchKey,
    MatchPlan,
    ParticipantId,
    ResolvedSide,
)


class DefaultAdvancementEngine:
    """Satisfies ``app.engine.AdvancementEngine``."""

    def resolve(self, request: AdvancementRequest) -> AdvancementResult:
        by_key: dict[MatchKey, MatchPlan] = {m.key: m for m in request.matches}

        for match_key in request.winners:
            if match_key not in by_key:
                raise EngineValidationError(
                    [Issue(match_key, "unknown_match", "winner reported for an unknown match")]
                )

        winners: dict[MatchKey, ParticipantId] = dict(request.winners)
        byes: set[MatchKey] = set()

        # Fixpoint: derive bye walkovers and let them cascade into downstream matches.
        for _ in range(len(by_key) + 1):
            changed = False
            for match_key, match in by_key.items():
                if match_key in winners:
                    continue
                sides = self._resolve_sides(match, request.seeds, winners)
                if any(s.is_pending for s in sides):
                    continue
                real = [s.participant_id for s in sides if s.participant_id is not None]
                if any(s.is_bye for s in sides) and len(real) == 1:
                    winners[match_key] = real[0]
                    byes.add(match_key)
                    changed = True
            if not changed:
                break

        sides_map = {
            key: self._resolve_sides(match, request.seeds, winners) for key, match in by_key.items()
        }

        # A reported winner must be one of its match's resolved participant sides.
        for match_key, winner in request.winners.items():
            side_ids = {s.participant_id for s in sides_map[match_key] if s.participant_id}
            if winner not in side_ids:
                raise EngineValidationError(
                    [Issue(match_key, "invalid_winner", f"{winner!r} is not a side of {match_key}")]
                )

        ready = frozenset(
            key
            for key, sides in sides_map.items()
            if key not in byes and all(s.participant_id is not None for s in sides)
        )
        return AdvancementResult(
            sides=sides_map, winners=winners, ready=ready, byes=frozenset(byes)
        )

    @staticmethod
    def _resolve_sides(
        match: MatchPlan,
        seeds: Mapping[int, ParticipantId],
        winners: Mapping[MatchKey, ParticipantId],
    ) -> tuple[ResolvedSide, ...]:
        resolved: list[ResolvedSide] = []
        for ref in match.source_refs.sides:
            if isinstance(ref, SeedRef):
                resolved.append(ResolvedSide(participant_id=seeds.get(ref.seed)))
            elif isinstance(ref, ParticipantSideRef):
                resolved.append(ResolvedSide(participant_id=ref.participant_id))
            elif isinstance(ref, WinnerOfRef):
                resolved.append(ResolvedSide(participant_id=winners.get(ref.match_key)))
            elif isinstance(ref, ByeRef):
                resolved.append(ResolvedSide(is_bye=True))
            elif isinstance(ref, LoserOfRef):
                resolved.append(ResolvedSide(participant_id=None))  # deferred (double elim)
        return tuple(resolved)
