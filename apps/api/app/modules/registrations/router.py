"""Registration/participant HTTP endpoints.

Submitting is self-service (any active-org member); approving/rejecting/listing is an
organizer action (``tournament:update``); withdrawing is restricted to the submitter.
Tenant-scoped via ``get_request_session`` + org-scoped repo queries.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    Principal,
    authed_csrf,
    get_principal,
    get_request_session,
    require_permission,
)
from app.core import authz
from app.db.models import Participant, Registration
from app.modules.registrations import repository as repo
from app.modules.registrations import service
from app.modules.registrations.schemas import (
    ApproveResult,
    ParticipantResponse,
    RegistrationResponse,
    SubmitRegistrationRequest,
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
        created_at=reg.created_at,
    )


def _participant_response(p: Participant) -> ParticipantResponse:
    return ParticipantResponse(
        id=p.id,
        division_id=p.division_id,
        kind=p.kind,
        display_name=p.display_name,
        seed=p.seed,
        status=p.status,
        user_id=p.user_id,
        team_id=p.team_id,
        created_at=p.created_at,
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
    return [_participant_response(p) for p in rows]


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
