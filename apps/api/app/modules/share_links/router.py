"""Organizer endpoints — one scorekeeper link per match."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    Principal,
    authed_csrf,
    get_request_session,
    require_permission,
)
from app.core import authz
from app.modules.share_links import service
from app.modules.share_links.schemas import (
    CheckInLinkView,
    CreateDivisionCheckInLinkRequest,
    CreateMatchScorekeeperLinkRequest,
    ScorekeeperLinkView,
)

router = APIRouter(tags=["share-links"])

_scoring = require_permission(authz.SCORING_WRITE)
_tournament = require_permission(authz.TOURNAMENT_UPDATE)


@router.get(
    "/matches/{match_id}/scorekeeper-link",
    response_model=ScorekeeperLinkView | None,
)
async def get_match_scorekeeper_link(
    match_id: uuid.UUID,
    principal: Principal = Depends(_scoring),
    session: AsyncSession = Depends(get_request_session),
) -> ScorekeeperLinkView | None:
    return await service.get_match_scorekeeper_link(
        session, org_id=principal.organization_id, match_id=match_id
    )


@router.post(
    "/matches/{match_id}/scorekeeper-link",
    response_model=ScorekeeperLinkView,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(authed_csrf)],
)
async def create_match_scorekeeper_link(
    match_id: uuid.UUID,
    body: CreateMatchScorekeeperLinkRequest,
    principal: Principal = Depends(_scoring),
    session: AsyncSession = Depends(get_request_session),
) -> ScorekeeperLinkView:
    link, raw = await service.create_match_scorekeeper_link(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        match_id=match_id,
        expires_in_hours=body.expires_in_hours,
        recipient_email=body.recipient_email,
        recipient_name=body.recipient_name,
    )
    return service.link_view(link, url=service.scorekeeper_url(raw))


@router.delete(
    "/matches/{match_id}/scorekeeper-link",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(authed_csrf)],
)
async def revoke_match_scorekeeper_link(
    match_id: uuid.UUID,
    principal: Principal = Depends(_scoring),
    session: AsyncSession = Depends(get_request_session),
) -> None:
    await service.revoke_match_scorekeeper_link(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        match_id=match_id,
    )


@router.get(
    "/divisions/{division_id}/checkin-link",
    response_model=CheckInLinkView | None,
)
async def get_division_checkin_link(
    division_id: uuid.UUID,
    principal: Principal = Depends(_tournament),
    session: AsyncSession = Depends(get_request_session),
) -> CheckInLinkView | None:
    return await service.get_division_checkin_link(
        session, org_id=principal.organization_id, division_id=division_id
    )


@router.post(
    "/divisions/{division_id}/checkin-link",
    response_model=CheckInLinkView,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(authed_csrf)],
)
async def create_division_checkin_link(
    division_id: uuid.UUID,
    body: CreateDivisionCheckInLinkRequest,
    principal: Principal = Depends(_tournament),
    session: AsyncSession = Depends(get_request_session),
) -> CheckInLinkView:
    link, raw = await service.create_division_checkin_link(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        division_id=division_id,
        expires_in_hours=body.expires_in_hours,
    )
    return CheckInLinkView(
        id=link.id,
        division_id=link.division_id,
        tournament_id=link.tournament_id,
        expires_at=link.expires_at,
        revoked=link.revoked,
        url=service.checkin_url(raw),
    )
