"""Pre-flight fairness check for franchise pairings.

The draw aligns leg *N* of a tie to pair *N* on both squads, after ordering each
squad's pairs strongest-first by combined strength. That produces a fair,
tier-for-tier fixture (advanced-v-advanced, beginner-v-beginner) **only if every
squad has the same sorted strength profile** — the invariant the engine leans on.

Manual pairing has no skill rule, so a captain who builds an off-sheet pair (two
advanced players together, say) silently breaks that invariant and sets an
advanced pair against beginners. This module turns each squad's pairs into its
sorted strength profile and reports whether they all match, so a data-entry slip
is caught *before* matches are generated rather than discovered on court.

Pure data in, pure data out — no database, no framework. Unit-testable in
isolation; the service layer feeds it real strengths and squad names.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class SquadTierProfile:
    squad_id: uuid.UUID
    squad_name: str
    # Pair strengths, strongest first — the shape the draw actually aligns on.
    profile: tuple[float, ...]
    aligned: bool
    """True when this squad's profile matches the reference (most common) profile."""


@dataclass(frozen=True)
class TierAlignmentReport:
    aligned: bool
    """True when every squad shares one strength profile — a fully fair draw."""
    reference: tuple[float, ...]
    """The profile the majority of squads share; deviations are measured against it."""
    squads: list[SquadTierProfile]

    @property
    def deviating(self) -> list[SquadTierProfile]:
        return [s for s in self.squads if not s.aligned]


def _profile(strengths: list[Decimal]) -> tuple[float, ...]:
    """Strongest-first strength tuple — the exact order the draw pairs on."""
    return tuple(float(s) for s in sorted(strengths, reverse=True))


def analyze_tier_alignment(
    squad_strengths: dict[uuid.UUID, list[Decimal]],
    squad_names: dict[uuid.UUID, str],
) -> TierAlignmentReport:
    """Compare every squad's sorted strength profile.

    The reference profile is the one the most squads share (ties broken by taking
    the strongest profile, so a lone off-sheet squad is what stands out, not the
    majority). A squad is ``aligned`` when its profile equals the reference.
    """
    profiles: dict[uuid.UUID, tuple[float, ...]] = {
        sid: _profile(strengths) for sid, strengths in squad_strengths.items()
    }

    counts: dict[tuple[float, ...], int] = {}
    for prof in profiles.values():
        counts[prof] = counts.get(prof, 0) + 1

    # Most common profile wins; on a tie, prefer the stronger (higher) profile so
    # the reference is a "correct-looking" shape rather than an arbitrary one.
    reference: tuple[float, ...] = ()
    if counts:
        reference = sorted(counts, key=lambda p: (counts[p], p), reverse=True)[0]

    squads = [
        SquadTierProfile(
            squad_id=sid,
            squad_name=squad_names.get(sid, str(sid)),
            profile=prof,
            aligned=prof == reference,
        )
        for sid, prof in profiles.items()
    ]
    squads.sort(key=lambda s: (s.aligned, s.squad_name))

    return TierAlignmentReport(
        aligned=all(s.aligned for s in squads),
        reference=reference,
        squads=squads,
    )
