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
from app.modules.registrations import repository as registrations_repo
from app.modules.squads import repository as squad_repo

_MIN_TO_DRAW = 2
_ACTIVE_REG = {RegistrationStatus.SUBMITTED.value, RegistrationStatus.WAITLISTED.value}


def _division_readiness(
    division: Division,
    participants: Sequence[Participant],
    registrations: Sequence[Registration],
    drawn: bool,
    *,
    franchise_mode: bool = False,
) -> DivisionReadinessView:
    approved_participants = [
        p for p in participants if p.status == ParticipantStatus.APPROVED.value
    ]
    # Attendance is a fact about people. Pairs and franchise teams are groupings of
    # the same people, and can never check in themselves — counting them left 30
    # pairs and 4 teams permanently "awaiting check-in" after every player had
    # already arrived. Whenever individual rows exist, they are the ones to count.
    individuals = [p for p in approved_participants if p.kind == ParticipantKind.INDIVIDUAL.value]

    if individuals:
        # Count players from registrations; check-in stays on individual rows.
        approved_regs = [r for r in registrations if r.status == RegistrationStatus.APPROVED.value]
        approved_count = len(approved_regs) or len(individuals)
        checked_in = sum(
            1 for p in individuals if p.attendance == AttendanceStatus.CHECKED_IN.value
        )
        pending = sum(1 for p in individuals if p.attendance == AttendanceStatus.PENDING.value)
        absent = sum(1 for p in individuals if p.attendance == AttendanceStatus.ABSENT.value)
    else:
        approved_count = len(approved_participants)
        checked_in = sum(
            1 for p in approved_participants if p.attendance == AttendanceStatus.CHECKED_IN.value
        )
        pending = sum(
            1 for p in approved_participants if p.attendance == AttendanceStatus.PENDING.value
        )
        absent = sum(
            1 for p in approved_participants if p.attendance == AttendanceStatus.ABSENT.value
        )

    # Entrants who registered but aren't yet a competing participant (awaiting approval or,
    # for doubles, awaiting pairing) — the "missing players / partners" signal.
    unpaired = sum(1 for r in registrations if r.participant_id is None and r.status in _ACTIVE_REG)

    # Registration lifecycle counts for the capacity panel (different from attendance pending).
    regs_submitted = sum(1 for r in registrations if r.status == RegistrationStatus.SUBMITTED.value)
    regs_waitlisted = sum(
        1 for r in registrations if r.status == RegistrationStatus.WAITLISTED.value
    )
    regs_rejected = sum(1 for r in registrations if r.status == RegistrationStatus.REJECTED.value)

    blockers: list[str] = []
    if approved_count < _MIN_TO_DRAW:
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

    all_checked_in = approved_count >= _MIN_TO_DRAW and pending == 0
    ready_for_draw = all_checked_in and not drawn
    ready_for_start = drawn and all_checked_in

    return DivisionReadinessView(
        division_id=division.id,
        division_name=division.name,
        participant_type=division.participant_type,
        approved=approved_count,
        checked_in=checked_in,
        pending=pending,
        absent=absent,
        unpaired_entrants=unpaired,
        drawn=drawn,
        ready_for_draw=ready_for_draw,
        ready_for_start=ready_for_start,
        blockers=blockers,
        registrations_submitted=regs_submitted,
        registrations_waitlisted=regs_waitlisted,
        registrations_rejected=regs_rejected,
    )


async def tournament_readiness(
    session: AsyncSession, org_id: uuid.UUID, tournament_id: uuid.UUID
) -> TournamentReadinessView:
    tournament = await repo.get_tournament(session, org_id, tournament_id)
    if tournament is None:
        raise NotFoundError("Tournament not found")

    divisions = list(await repo.list_divisions(session, org_id, tournament_id))
    drawn_ids = await repo.divisions_drawn(session, org_id, tournament_id)

    squads = await squad_repo.list_squads(session, org_id, tournament_id)
    squad_count = len(squads)
    assigned_reg_ids = {m.registration_id for s in squads for m in s.members}
    eligible_regs = await squad_repo.list_eligible_registrations(session, org_id, tournament_id)
    unassigned_squad = sum(1 for r in eligible_regs if r.id not in assigned_reg_ids)
    squads_ready = squad_count == 0 or unassigned_squad == 0

    all_participants = await repo.list_tournament_participants(session, org_id, tournament_id)
    all_registrations = await registrations_repo.list_registrations_for_tournament(
        session, org_id, tournament_id
    )
    participants_by_div: dict[uuid.UUID, list[Participant]] = {}
    for p in all_participants:
        participants_by_div.setdefault(p.division_id, []).append(p)
    registrations_by_div: dict[uuid.UUID, list[Registration]] = {}
    for r in all_registrations:
        registrations_by_div.setdefault(r.division_id, []).append(r)

    views: list[DivisionReadinessView] = []
    total_checked_in = total_pending = 0
    franchise_mode = squad_count > 0
    for division in divisions:
        participants = participants_by_div.get(division.id, [])
        registrations = registrations_by_div.get(division.id, [])
        view = _division_readiness(
            division,
            participants,
            registrations,
            division.id in drawn_ids,
            franchise_mode=franchise_mode
            and division.participant_type == ParticipantKind.INDIVIDUAL.value,
        )
        views.append(view)
        total_checked_in += view.checked_in
        total_pending += view.pending

    return TournamentReadinessView(
        tournament_id=tournament_id,
        divisions=views,
        total_checked_in=total_checked_in,
        total_pending=total_pending,
        squad_count=squad_count,
        unassigned_squad_members=unassigned_squad,
        squads_ready=squads_ready,
    )
