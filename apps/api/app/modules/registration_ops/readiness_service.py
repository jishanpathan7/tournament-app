"""Readiness dashboard — per-division check-in + registration completeness, and whether
each division is ready to draw or to start. Read-only; reuses the participant/registration
repos. The draw gate itself lives in the tournaments service (this is the reporting view)."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import NotFoundError
from app.db.enums import AttendanceStatus, ParticipantKind, ParticipantStatus, RegistrationStatus
from app.db.models import Division, Participant, Registration
from app.modules.registration_ops import repository as repo
from app.modules.registration_ops.schemas import DivisionReadinessView, TournamentReadinessView

_MIN_TO_DRAW = 2
_ACTIVE_REG = {RegistrationStatus.SUBMITTED.value, RegistrationStatus.WAITLISTED.value}


def _division_readiness(
    division: Division,
    participants: Sequence[Participant],
    registrations: Sequence[Registration],
    drawn: bool,
) -> DivisionReadinessView:
    approved = [p for p in participants if p.status == ParticipantStatus.APPROVED.value]
    checked_in = sum(1 for p in approved if p.attendance == AttendanceStatus.CHECKED_IN.value)
    pending = sum(1 for p in approved if p.attendance == AttendanceStatus.PENDING.value)
    absent = sum(1 for p in approved if p.attendance == AttendanceStatus.ABSENT.value)
    # Entrants who registered but aren't yet a competing participant (awaiting approval or,
    # for doubles, awaiting pairing) — the "missing players / partners" signal.
    unpaired = sum(1 for r in registrations if r.participant_id is None and r.status in _ACTIVE_REG)

    blockers: list[str] = []
    if len(approved) < _MIN_TO_DRAW:
        blockers.append(f"needs at least {_MIN_TO_DRAW} approved participants")
    if pending:
        blockers.append(f"{pending} awaiting check-in")
    if unpaired:
        noun = (
            "awaiting a partner"
            if division.participant_type != ParticipantKind.INDIVIDUAL.value
            else "awaiting approval"
        )
        blockers.append(f"{unpaired} {noun}")

    all_checked_in = len(approved) >= _MIN_TO_DRAW and pending == 0
    ready_for_draw = all_checked_in and not drawn
    ready_for_start = drawn and all_checked_in

    return DivisionReadinessView(
        division_id=division.id,
        division_name=division.name,
        participant_type=division.participant_type,
        approved=len(approved),
        checked_in=checked_in,
        pending=pending,
        absent=absent,
        unpaired_entrants=unpaired,
        drawn=drawn,
        ready_for_draw=ready_for_draw,
        ready_for_start=ready_for_start,
        blockers=blockers,
    )


async def tournament_readiness(
    session: AsyncSession, org_id: uuid.UUID, tournament_id: uuid.UUID
) -> TournamentReadinessView:
    tournament = await repo.get_tournament(session, org_id, tournament_id)
    if tournament is None:
        raise NotFoundError("Tournament not found")

    divisions = list(await repo.list_divisions(session, org_id, tournament_id))
    drawn_ids = await repo.divisions_drawn(session, org_id, tournament_id)

    views: list[DivisionReadinessView] = []
    total_checked_in = total_pending = 0
    for division in divisions:
        participants = await repo.list_participants(session, org_id, division.id)
        registrations = await repo.list_registrations(session, org_id, division.id)
        view = _division_readiness(division, participants, registrations, division.id in drawn_ids)
        views.append(view)
        total_checked_in += view.checked_in
        total_pending += view.pending

    return TournamentReadinessView(
        tournament_id=tournament_id,
        divisions=views,
        total_checked_in=total_checked_in,
        total_pending=total_pending,
    )
