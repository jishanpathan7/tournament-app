"""Registration/participant HTTP endpoints.

Submitting is self-service (any active-org member); approving/rejecting/listing is an
organizer action (``tournament:update``); withdrawing is restricted to the submitter.
Tenant-scoped via ``get_request_session`` + org-scoped repo queries.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

import app.modules.registrations.notifications  # noqa: F401 — register email templates
from app.api.deps import (
    Principal,
    authed_csrf,
    get_principal,
    get_request_session,
    require_permission,
)
from app.api.errors import NotFoundError
from app.core import authz
from app.db.models import Participant, Registration, Team
from app.modules.registrations import repository as repo
from app.modules.registrations import service
from app.modules.registrations.schemas import (
    ApproveResult,
    BulkApproveResult,
    ParticipantResponse,
    ParticipantUpdate,
    RegistrationResponse,
    RosterEntryItem,
    SubmitRegistrationRequest,
    TeamResponse,
)

router = APIRouter(tags=["registrations"])

_manage = require_permission(authz.TOURNAMENT_UPDATE)


def _registration_response(reg: Registration) -> RegistrationResponse:
    return RegistrationResponse(
        id=reg.id,
        division_id=reg.division_id,
        submitted_by=reg.submitted_by,
        status=reg.status,
        skill_level=reg.skill_level,
        participant_id=reg.participant_id,
        form_response=reg.form_response,
        created_at=reg.created_at,
    )


def _team_response(team: Team) -> TeamResponse:
    return TeamResponse(
        id=team.id,
        name=team.name,
        captain_user_id=team.captain_user_id,
        roster=[
            RosterEntryItem(
                id=entry.id,
                user_id=entry.user_id,
                external_name=entry.external_name,
                role=entry.role,
            )
            for entry in team.roster_entries
        ],
    )


def _participant_response(
    p: Participant,
    *,
    participants_with_matches: set[uuid.UUID] | None = None,
    individuals_in_pairs: set[uuid.UUID] | None = None,
) -> ParticipantResponse:
    # Pair participants have team_id set. Individual participants that were paired by
    # the engine don't — check the individuals_in_pairs set (built via RosterEntry).
    in_pair = p.team_id is not None or (
        individuals_in_pairs is not None and p.id in individuals_in_pairs
    )
    return ParticipantResponse(
        id=p.id,
        division_id=p.division_id,
        kind=p.kind,
        display_name=p.display_name,
        email=p.email,
        phone=p.phone,
        gender=p.gender,
        partner_preference=p.partner_preference,
        seed=p.seed,
        status=p.status,
        skill_level=p.skill_level,
        user_id=p.user_id,
        team_id=p.team_id,
        # SQUAD name, not the pair's own name (see Team.squad_id).
        team_name=p.team.squad.name if p.team and p.team.squad else None,
        created_at=p.created_at,
        has_published_pair=in_pair,
        has_match_results=(
            p.id in participants_with_matches if participants_with_matches is not None else False
        ),
    )


@router.post(
    "/divisions/{division_id}/registrations",
    response_model=RegistrationResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(authed_csrf)],
)
async def submit_registration(
    division_id: uuid.UUID,
    body: SubmitRegistrationRequest,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> RegistrationResponse:
    registration = await service.submit_registration(
        session,
        org_id=principal.organization_id,
        user_id=principal.user_id,
        division_id=division_id,
        form_response=body.form_response,
        skill_level=body.skill_level,
    )
    return _registration_response(registration)


@router.get("/divisions/{division_id}/registrations", response_model=list[RegistrationResponse])
async def list_registrations(
    division_id: uuid.UUID,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> list[RegistrationResponse]:
    rows = await repo.list_registrations(session, principal.organization_id, division_id)
    return [_registration_response(r) for r in rows]


@router.get("/divisions/{division_id}/participants", response_model=list[ParticipantResponse])
async def list_participants(
    division_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> list[ParticipantResponse]:
    rows = await repo.list_participants(session, principal.organization_id, division_id)
    participant_ids = {p.id for p in rows}
    individual_ids = {p.id for p in rows if p.kind == "individual"}
    with_matches = await repo.batch_has_match_links(
        session, principal.organization_id, participant_ids
    )
    in_pairs = await repo.batch_individual_in_pair(
        session, principal.organization_id, individual_ids
    )
    return [
        _participant_response(p, participants_with_matches=with_matches, individuals_in_pairs=in_pairs)
        for p in rows
    ]


@router.post(
    "/divisions/{division_id}/registrations/approve-all",
    response_model=BulkApproveResult,
    dependencies=[Depends(authed_csrf)],
)
async def approve_all_registrations(
    division_id: uuid.UUID,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> BulkApproveResult:
    approved, waitlisted, skipped = await service.approve_all(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        division_id=division_id,
    )
    return BulkApproveResult(approved=approved, waitlisted=waitlisted, skipped=skipped)


@router.post(
    "/registrations/{registration_id}/approve",
    response_model=ApproveResult,
    dependencies=[Depends(authed_csrf)],
)
async def approve_registration(
    registration_id: uuid.UUID,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> ApproveResult:
    registration, participant = await service.approve_registration(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        registration_id=registration_id,
    )
    return ApproveResult(
        registration_id=registration.id,
        status=registration.status,
        participant_id=participant.id if participant else None,
    )


@router.post(
    "/registrations/{registration_id}/reject",
    response_model=RegistrationResponse,
    dependencies=[Depends(authed_csrf)],
)
async def reject_registration(
    registration_id: uuid.UUID,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> RegistrationResponse:
    registration = await service.reject_registration(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        registration_id=registration_id,
    )
    return _registration_response(registration)


@router.post(
    "/registrations/{registration_id}/waitlist",
    response_model=RegistrationResponse,
    dependencies=[Depends(authed_csrf)],
)
async def waitlist_registration(
    registration_id: uuid.UUID,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> RegistrationResponse:
    registration = await service.waitlist_registration(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        registration_id=registration_id,
    )
    return _registration_response(registration)


@router.post(
    "/registrations/{registration_id}/withdraw",
    response_model=RegistrationResponse,
    dependencies=[Depends(authed_csrf)],
)
async def withdraw_registration(
    registration_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> RegistrationResponse:
    registration = await service.withdraw_registration(
        session,
        org_id=principal.organization_id,
        user_id=principal.user_id,
        registration_id=registration_id,
    )
    return _registration_response(registration)


@router.patch(
    "/participants/{participant_id}",
    response_model=ParticipantResponse,
    dependencies=[Depends(authed_csrf)],
)
async def update_participant(
    participant_id: uuid.UUID,
    body: ParticipantUpdate,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> ParticipantResponse:
    participant = await service.update_participant(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        participant_id=participant_id,
        data=body,
    )
    pid = {participant.id}
    individual_ids = pid if participant.kind == "individual" else set()
    with_matches = await repo.batch_has_match_links(session, principal.organization_id, pid)
    in_pairs = await repo.batch_individual_in_pair(
        session, principal.organization_id, individual_ids
    )
    return _participant_response(
        participant, participants_with_matches=with_matches, individuals_in_pairs=in_pairs
    )


@router.delete(
    "/participants/{participant_id}",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(authed_csrf)],
)
async def remove_participant(
    participant_id: uuid.UUID,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> dict:
    return await service.remove_participant(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        participant_id=participant_id,
    )


@router.get("/teams/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> TeamResponse:
    team = await repo.get_team_with_roster(session, principal.organization_id, team_id)
    if team is None:
        raise NotFoundError("Team not found")
    return _team_response(team)
