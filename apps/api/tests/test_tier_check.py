"""Pure tier-alignment analysis — no DB. Mirrors the SIBL rosters: four squads,
each 3 Advanced / 7 Intermediate / 4 Beginner, so every squad's strength profile
should be [6, 5, 4, 4, 4, 2, 2] and the draw pairs tier-for-tier."""

from __future__ import annotations

import uuid
from decimal import Decimal

from app.modules.franchise_ties.tier_check import analyze_tier_alignment

# Skill weights: Advanced 3, Intermediate 2, Beginner 1.
SIBL_PROFILE = [
    Decimal(6),  # A+A
    Decimal(5),  # A+I
    Decimal(4),  # I+I
    Decimal(4),  # I+I
    Decimal(4),  # I+I
    Decimal(2),  # B+B
    Decimal(2),  # B+B
]


def _named(n: int) -> tuple[dict, dict]:
    ids = [uuid.uuid4() for _ in range(n)]
    return ids, {sid: f"Team {i + 1}" for i, sid in enumerate(ids)}


def test_identical_squads_are_aligned() -> None:
    ids, names = _named(4)
    # Feed unsorted to prove the analyzer sorts before comparing.
    strengths = {sid: list(reversed(SIBL_PROFILE)) for sid in ids}
    report = analyze_tier_alignment(strengths, names)

    assert report.aligned is True
    assert report.reference == (6.0, 5.0, 4.0, 4.0, 4.0, 2.0, 2.0)
    assert report.deviating == []


def test_one_off_sheet_squad_is_flagged() -> None:
    ids, names = _named(4)
    strengths = {sid: list(SIBL_PROFILE) for sid in ids}
    # Team 4 made two advanced pairs (6, 6) and no A+I — an off-sheet entry.
    strengths[ids[3]] = [
        Decimal(6),
        Decimal(6),
        Decimal(4),
        Decimal(4),
        Decimal(3),
        Decimal(2),
        Decimal(2),
    ]
    report = analyze_tier_alignment(strengths, names)

    assert report.aligned is False
    # The majority (3 squads) sets the reference; the lone squad deviates.
    assert report.reference == (6.0, 5.0, 4.0, 4.0, 4.0, 2.0, 2.0)
    assert [s.squad_name for s in report.deviating] == ["Team 4"]


def test_empty_input_is_trivially_aligned() -> None:
    report = analyze_tier_alignment({}, {})
    assert report.aligned is True
    assert report.squads == []


def test_all_deviating_from_each_other_reports_not_aligned() -> None:
    ids, names = _named(2)
    strengths = {
        ids[0]: [Decimal(6), Decimal(4)],
        ids[1]: [Decimal(5), Decimal(5)],
    }
    report = analyze_tier_alignment(strengths, names)
    assert report.aligned is False
    # Tie on frequency (1 each) → the stronger profile becomes the reference.
    assert report.reference == (6.0, 4.0)
    assert [s.squad_name for s in report.deviating] == ["Team 2"]
