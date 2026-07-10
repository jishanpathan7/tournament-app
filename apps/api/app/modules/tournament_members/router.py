"""Tournament members endpoints — collaborative tournament management."""

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
from app.core.factory import get_email_channel
from app.core.ports import EmailChannel
from app.modules.tournament_members import service
from app.modules.tournament_members.schemas import (
    GenerateInviteLinkRequest,
    InviteLinkResponse,
    InviteTournamentMemberRequest,
    TournamentInviteResponse,
    TournamentMemberResponse,
    TournamentMembersListResponse,
    UpdateTournamentMemberRoleRequest,
)
from app.modules.tournaments import repository as tournaments_repo

router = APIRouter(prefix="/tournaments/{tournament_id}/members", tags=["tournament-members"])

_manage = require_permission(authz.TOURNAMENT_UPDATE)
_admin = require_permission(authz.MEMBER_INVITE)


async def _require_tournament(
    session: AsyncSession, org_id: uuid.UUID, tournament_id: uuid.UUID
) -> str:
    t = await tournaments_repo.get_tournament(session, org_id, tournament_id)
    if t is None:
        from app.api.errors import NotFoundError

        raise NotFoundError("Tournament not found")
    return t.name


@router.get("", response_model=TournamentMembersListResponse)
async def list_members(
    tournament_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> TournamentMembersListResponse:
    members, invites = await service.list_members(
        session,
        org_id=principal.organization_id,
        tournament_id=tournament_id,
    )
    return TournamentMembersListResponse(
        members=[TournamentMemberResponse(**m) for m in members],
        pending_invites=[TournamentInviteResponse(**i) for i in invites],
    )


@router.post(
    "/invite",
    response_model=TournamentInviteResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(authed_csrf), Depends(_manage)],
)
async def invite_member(
    tournament_id: uuid.UUID,
    body: InviteTournamentMemberRequest,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
    email_channel: EmailChannel = Depends(get_email_channel),
) -> TournamentInviteResponse:
    tournament_name = await _require_tournament(session, principal.organization_id, tournament_id)
    invite = await service.invite_member(
        session,
        org_id=principal.organization_id,
        tournament_id=tournament_id,
        actor_id=principal.user_id,
        email=body.email,
        tournament_role=body.tournament_role,
        email_channel=email_channel,
        tournament_name=tournament_name,
    )
    return TournamentInviteResponse(
        id=str(invite.id),
        email=invite.email,
        tournament_id=str(invite.tournament_id),
        tournament_role=invite.tournament_role,
        status=invite.status,
        expires_at=invite.expires_at,
        created_at=invite.created_at,
    )


@router.post(
    "/invite-link",
    response_model=InviteLinkResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(authed_csrf), Depends(_manage)],
)
async def generate_invite_link(
    tournament_id: uuid.UUID,
    body: GenerateInviteLinkRequest,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> InviteLinkResponse:
    raw_token, expires_at = await service.generate_invite_link(
        session,
        org_id=principal.organization_id,
        tournament_id=tournament_id,
        actor_id=principal.user_id,
        tournament_role=body.tournament_role,
    )
    return InviteLinkResponse(token=raw_token, expires_at=expires_at)


@router.patch(
    "/{user_id}/role",
    response_model=TournamentMemberResponse,
    dependencies=[Depends(authed_csrf), Depends(_manage)],
)
async def update_member_role(
    tournament_id: uuid.UUID,
    user_id: uuid.UUID,
    body: UpdateTournamentMemberRoleRequest,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> TournamentMemberResponse:
    member = await service.update_member_role(
        session,
        tournament_id=tournament_id,
        user_id=user_id,
        new_role=body.tournament_role,
    )
    return TournamentMemberResponse(
        id=str(member.id),
        user_id=str(member.user_id),
        tournament_id=str(member.tournament_id),
        tournament_role=member.tournament_role,
        name=member.user.name if member.user else "",
        email=member.user.email if member.user else "",
        invited_by=str(member.invited_by) if member.invited_by else None,
        accepted_at=member.accepted_at,
        created_at=member.created_at,
    )


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(authed_csrf), Depends(_manage)],
)
async def remove_member(
    tournament_id: uuid.UUID,
    user_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> None:
    await service.remove_member(
        session,
        tournament_id=tournament_id,
        user_id=user_id,
    )


@router.post(
    "/invites/{invite_id}/revoke",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(authed_csrf), Depends(_manage)],
)
async def revoke_invite(
    tournament_id: uuid.UUID,
    invite_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> None:
    await service.revoke_invite(
        session,
        tournament_id=tournament_id,
        invite_id=invite_id,
    )


@router.post(
    "/invites/{invite_id}/resend",
    response_model=TournamentInviteResponse,
    dependencies=[Depends(authed_csrf), Depends(_manage)],
)
async def resend_invite(
    tournament_id: uuid.UUID,
    invite_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
    email_channel: EmailChannel = Depends(get_email_channel),
) -> TournamentInviteResponse:
    tournament_name = await _require_tournament(session, principal.organization_id, tournament_id)
    invite = await service.resend_invite(
        session,
        org_id=principal.organization_id,
        tournament_id=tournament_id,
        invite_id=invite_id,
        email_channel=email_channel,
        tournament_name=tournament_name,
    )
    return TournamentInviteResponse(
        id=str(invite.id),
        email=invite.email,
        tournament_id=str(invite.tournament_id),
        tournament_role=invite.tournament_role,
        status=invite.status,
        expires_at=invite.expires_at,
        created_at=invite.created_at,
    )


# Accept-invite is a public endpoint — no org context required
accept_router = APIRouter(prefix="/tournament-invites", tags=["tournament-members"])


@accept_router.post("/accept", dependencies=[Depends(authed_csrf)])
async def accept_invite(
    body: dict,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> dict:
    token = body.get("token", "")
    await service.accept_invite(
        session,
        raw_token=token,
        user_id=principal.user_id,
        org_id=principal.organization_id,
    )
    return {"accepted": True}
