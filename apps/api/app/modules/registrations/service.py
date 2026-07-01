"""Registration use cases: submit → approve (→ Participant/Team) / waitlist / reject /
withdraw. Roster-shape validation is delegated to the Sport Profile (engine); no sport
rules are reimplemented here. Never commits — the request session owns the transaction.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ConflictError, NotFoundError, PermissionDeniedError, ValidationError
from app.core import audit
from app.core.events import emit_event
from app.core.factory import get_sport_registry
from app.db.enums import (
    ParticipantKind,
    ParticipantStatus,
    RegistrationStatus,
    SkillLevel,
    TournamentStatus,
)
from app.db.models import Participant, Registration, RosterEntry, Team
from app.engine import EngineValidationError
from app.modules.registrations import events
from app.modules.registrations import repository as repo

_APPROVABLE = {RegistrationStatus.SUBMITTED.value, RegistrationStatus.WAITLISTED.value}


async def submit_registration(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    division_id: uuid.UUID,
    form_response: dict[str, Any],
    skill_level: SkillLevel | None,
) -> Registration:
    division = await _require_division(session, org_id, division_id)
    tournament = await repo.get_tournament(session, org_id, division.tournament_id)
    if tournament is None:
        raise NotFoundError("Tournament not found")
    if tournament.status != TournamentStatus.REGISTRATION.value:
        raise ValidationError(
            "registration is not open for this tournament", code="registration_closed"
        )

    registration = Registration(
        organization_id=org_id,
        division_id=division.id,
        submitted_by=user_id,
        form_response=form_response,
        status=RegistrationStatus.SUBMITTED.value,
        skill_level=skill_level.value if skill_level else None,
    )
    session.add(registration)
    await session.flush()
    await _audit_event(session, org_id, user_id, events.REGISTRATION_SUBMITTED, registration.id)
    return registration


async def approve_registration(
    session: AsyncSession, *, org_id: uuid.UUID, actor_id: uuid.UUID, registration_id: uuid.UUID
) -> tuple[Registration, Participant | None]:
    registration = await _require_registration(session, org_id, registration_id)
    if registration.status not in _APPROVABLE:
        raise ConflictError(f"registration is {registration.status}, cannot approve")
    division = await _require_division(session, org_id, registration.division_id)

    # Capacity → waitlist instead of approve.
    if division.capacity is not None:
        approved = await repo.count_approved(session, org_id, division.id)
        if approved >= division.capacity:
            registration.status = RegistrationStatus.WAITLISTED.value
            await session.flush()
            await _audit_event(
                session, org_id, actor_id, events.REGISTRATION_WAITLISTED, registration.id
            )
            return registration, None

    participant = await _build_participant(session, org_id, division, registration)
    registration.status = RegistrationStatus.APPROVED.value
    registration.participant_id = participant.id
    await session.flush()
    await _audit_event(
        session,
        org_id,
        actor_id,
        events.REGISTRATION_APPROVED,
        registration.id,
        after={"participantId": str(participant.id)},
    )
    return registration, participant


async def reject_registration(
    session: AsyncSession, *, org_id: uuid.UUID, actor_id: uuid.UUID, registration_id: uuid.UUID
) -> Registration:
    registration = await _require_registration(session, org_id, registration_id)
    if registration.status == RegistrationStatus.APPROVED.value:
        raise ConflictError("cannot reject an approved registration")
    registration.status = RegistrationStatus.REJECTED.value
    await session.flush()
    await _audit_event(session, org_id, actor_id, events.REGISTRATION_REJECTED, registration.id)
    return registration


async def withdraw_registration(
    session: AsyncSession, *, org_id: uuid.UUID, user_id: uuid.UUID, registration_id: uuid.UUID
) -> Registration:
    registration = await _require_registration(session, org_id, registration_id)
    if registration.submitted_by != user_id:
        raise PermissionDeniedError("only the submitter can withdraw this registration")
    registration.status = RegistrationStatus.WITHDRAWN.value
    if registration.participant_id is not None:
        participant = await session.get(Participant, registration.participant_id)
        if participant is not None:
            participant.status = ParticipantStatus.WITHDRAWN.value
    await session.flush()
    await _audit_event(session, org_id, user_id, events.REGISTRATION_WITHDRAWN, registration.id)
    return registration


# ---- participant construction ----


async def _build_participant(
    session: AsyncSession, org_id: uuid.UUID, division: Any, registration: Registration
) -> Participant:
    kind = ParticipantKind(division.participant_type)
    profile = await _sport_profile(session, org_id, division)

    if kind is ParticipantKind.INDIVIDUAL:
        roster_ids = [str(registration.submitted_by)]
        _validate_roster(profile, kind, roster_ids)
        user = await repo.get_user(session, registration.submitted_by)
        participant = Participant(
            organization_id=org_id,
            division_id=division.id,
            kind=kind.value,
            user_id=registration.submitted_by,
            display_name=user.name if user else "Player",
            skill_level=registration.skill_level,
            status=ParticipantStatus.APPROVED.value,
        )
        session.add(participant)
        await session.flush()
        return participant

    # pair / team → a Team + roster, referenced by the Participant.
    players = registration.form_response.get("players", [])
    roster_ids = [_player_identity(p) for p in players] if isinstance(players, list) else []
    _validate_roster(profile, kind, roster_ids)

    team_name = registration.form_response.get("teamName") or f"Team {str(registration.id)[:8]}"
    team = Team(organization_id=org_id, name=team_name, captain_user_id=registration.submitted_by)
    session.add(team)
    await session.flush()
    for player in players:
        session.add(
            RosterEntry(
                organization_id=org_id,
                team_id=team.id,
                user_id=_maybe_uuid(player.get("userId")),
                external_name=player.get("name"),
            )
        )
    participant = Participant(
        organization_id=org_id,
        division_id=division.id,
        kind=kind.value,
        team_id=team.id,
        display_name=team_name,
        skill_level=registration.skill_level,
        status=ParticipantStatus.APPROVED.value,
    )
    session.add(participant)
    await session.flush()
    return participant


def _validate_roster(profile: Any, kind: ParticipantKind, roster_ids: list[str]) -> None:
    try:
        profile.validate_participants(kind, [roster_ids])
    except EngineValidationError as exc:
        raise ValidationError(str(exc), code="invalid_roster") from exc


def _player_identity(player: Any) -> str:
    if not isinstance(player, dict):
        raise ValidationError("each player must be an object", code="invalid_roster")
    identity = player.get("userId") or player.get("name")
    if not identity:
        raise ValidationError("each player needs a userId or name", code="invalid_roster")
    return str(identity)


def _maybe_uuid(value: Any) -> uuid.UUID | None:
    if not value:
        return None
    try:
        return uuid.UUID(str(value))
    except ValueError as exc:
        raise ValidationError(f"invalid userId {value!r}", code="invalid_roster") from exc


async def _sport_profile(session: AsyncSession, org_id: uuid.UUID, division: Any) -> Any:
    tournament = await repo.get_tournament(session, org_id, division.tournament_id)
    if tournament is None:  # pragma: no cover
        raise NotFoundError("Tournament not found")
    profile_row = await repo.get_sport_profile(session, tournament.sport_profile_id)
    if profile_row is None:  # pragma: no cover
        raise NotFoundError("Sport profile not found")
    return get_sport_registry().get(profile_row.key)


# ---- helpers ----


async def _require_registration(
    session: AsyncSession, org_id: uuid.UUID, rid: uuid.UUID
) -> Registration:
    registration = await repo.get_registration(session, org_id, rid)
    if registration is None:
        raise NotFoundError("Registration not found")
    return registration


async def _require_division(session: AsyncSession, org_id: uuid.UUID, did: uuid.UUID) -> Any:
    division = await repo.get_division(session, org_id, did)
    if division is None:
        raise NotFoundError("Division not found")
    return division


async def _audit_event(
    session: AsyncSession,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    action: str,
    entity_id: uuid.UUID,
    *,
    after: dict[str, Any] | None = None,
) -> None:
    audit.record(
        session,
        organization_id=org_id,
        actor_id=actor_id,
        action=action,
        entity="registration",
        entity_id=entity_id,
        after=after,
    )
    await emit_event(
        session,
        aggregate="registration",
        event_type=action,
        payload={"id": str(entity_id), "organizationId": str(org_id)},
    )
