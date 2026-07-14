"""Attendance / check-in use cases — set a participant's event-day attendance
(single + bulk), for individuals and teams alike (a team is one Participant row, so it
checks in as a unit). Realtime + audit on every change. Never commits."""

from __future__ import annotations

import datetime
import uuid
from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import NotFoundError, ValidationError
from app.core import audit
from app.core.events import emit_event
from app.core.factory import get_broadcaster
from app.db.enums import AttendanceStatus, ParticipantKind, ParticipantStatus
from app.db.models import Participant
from app.modules.registration_ops import events
from app.modules.registration_ops import repository as repo
from app.modules.registration_ops.schemas import ParticipantAttendanceView
from app.realtime.channels import org_channel

_VALID = {s.value for s in AttendanceStatus}


def roster_for_check_in(participants: Sequence[Participant]) -> list[Participant]:
    """Event-day check-in roster.

    Singles/mixed draws: individuals are the check-in unit; once pairs are published
    the individual rows are suppressed in favour of pair rows.
    Franchise-squad draws: only pair participants exist (no individual rows), so
    pairs are returned directly.
    """
    approved = [p for p in participants if p.status == ParticipantStatus.APPROVED.value]
    individuals = [p for p in approved if p.kind == ParticipantKind.INDIVIDUAL.value]
    pairs = [p for p in approved if p.kind == ParticipantKind.PAIR.value]
    if pairs and individuals:
        # Mixed draw: pairs published alongside individuals — check in by individual.
        return individuals
    if pairs:
        # Franchise squad: only pairs exist — check in by pair.
        return pairs
    return approved


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def build_attendance_view(p: Participant) -> ParticipantAttendanceView:
    return ParticipantAttendanceView(
        id=p.id,
        division_id=p.division_id,
        kind=p.kind,
        display_name=p.display_name,
        status=p.status,
        attendance=p.attendance,
        checked_in_at=p.checked_in_at,
        seed=p.seed,
    )


def _apply(participant: Participant, status: str) -> None:
    participant.attendance = status
    participant.checked_in_at = _now() if status == AttendanceStatus.CHECKED_IN.value else None


async def list_attendance(
    session: AsyncSession, org_id: uuid.UUID, division_id: uuid.UUID
) -> list[Participant]:
    all_participants = await repo.list_participants(session, org_id, division_id)
    return roster_for_check_in(all_participants)


async def set_attendance(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    participant_id: uuid.UUID,
    status: str,
) -> Participant:
    _validate_status(status)
    participant = await repo.get_participant(session, org_id, participant_id)
    if participant is None:
        raise NotFoundError("Participant not found")
    _apply(participant, status)
    await session.flush()
    await _emit(session, org_id, actor_id, [participant], status)
    return participant


async def bulk_set_attendance(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    participant_ids: Sequence[uuid.UUID],
    status: str,
) -> list[uuid.UUID]:
    _validate_status(status)
    participants = list(await repo.get_participants(session, org_id, participant_ids))
    for participant in participants:
        _apply(participant, status)
    await session.flush()
    await _emit(session, org_id, actor_id, participants, status)
    return [p.id for p in participants]


def _validate_status(status: str) -> None:
    if status not in _VALID:
        raise ValidationError(f"unknown attendance status {status!r}", code="invalid_attendance")


async def _emit(
    session: AsyncSession,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    participants: list[Participant],
    status: str,
) -> None:
    if not participants:
        return
    for participant in participants:
        audit.record(
            session,
            organization_id=org_id,
            actor_id=actor_id,
            action=events.ATTENDANCE_UPDATED,
            entity="participant",
            entity_id=participant.id,
            after={"attendance": status},
        )
    # One realtime fan-out for the batch — the console refetches the division's roster.
    division_ids = sorted({str(p.division_id) for p in participants})
    payload = {
        "organizationId": str(org_id),
        "divisionIds": division_ids,
        "attendance": status,
    }
    await emit_event(
        session, aggregate="attendance", event_type=events.ATTENDANCE_UPDATED, payload=payload
    )
    await get_broadcaster().publish(org_channel(org_id), events.RT_ATTENDANCE_UPDATED, payload)
