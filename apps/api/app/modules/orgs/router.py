"""Organization HTTP endpoints.

Operations are scoped to the caller's ACTIVE organization (from the access token):
``get_request_session`` sets the RLS org context to it, and ``require_permission``
checks the token's role — so the path can never diverge from the authorized org.
Switching/creating/accepting re-mints the access cookie for the new active org.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth_context import CurrentUser, get_current_user
from app.api.deps import (
    Principal,
    authed_csrf,
    get_request_session,
    get_tx_session,
    require_permission,
)
from app.api.errors import NotFoundError, PermissionDeniedError
from app.cache import get_json
from app.cache import keys as cache_keys
from app.cache import set_json
from app.core import authz, security
from app.core.config import Settings, get_settings
from app.core.db import get_session
from app.core.factory import get_cache, get_email_channel
from app.core.ports import Cache, EmailChannel
from app.db.enums import OrgInviteStatus, OrgRole
from app.db.models import OrgInvite
from app.modules.auth import repository as auth_repo
from app.modules.auth.schemas import MeResponse, OrgSummary
from app.modules.auth.service import build_me
from app.modules.orgs import repository as repo
from app.modules.orgs import service
from app.modules.orgs.schemas import (
    AcceptInviteRequest,
    CreateInviteRequest,
    CreateOrgRequest,
    InviteItem,
    MemberItem,
    OrgResponse,
    SwitchOrgRequest,
    UpdateMemberRoleRequest,
    UpdateOrgRequest,
)

router = APIRouter(prefix="/orgs", tags=["orgs"])


def _secure(request: Request, settings: Settings) -> bool:
    return settings.cookie_secure or request.url.scheme == "https"


def _remint(
    response: Response, request: Request, current: CurrentUser, org_id: uuid.UUID, role: OrgRole
) -> None:
    token = security.encode_access(
        user_id=current.user_id,
        session_id=current.session_id,
        organization_id=org_id,
        org_role=role.value,
        remember=current.remember,
    )
    security.set_access_cookie(response, token, secure=_secure(request, get_settings()))


def _invite_item(invite: OrgInvite) -> InviteItem:
    return InviteItem(
        id=invite.id,
        email=invite.email,
        role=OrgRole(invite.org_role),
        status=OrgInviteStatus(invite.status),
        expires_at=invite.expires_at,
        created_at=invite.created_at,
    )


async def _me(
    session: AsyncSession, user_id: uuid.UUID, org_id: uuid.UUID, role: OrgRole
) -> MeResponse:
    user = await auth_repo.get_user_by_id(session, user_id)
    if user is None:
        raise NotFoundError("User not found")
    memberships = await auth_repo.list_memberships(session, user_id)
    return build_me(user, org_id, role, memberships)


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[Depends(authed_csrf)])
async def create_org(
    body: CreateOrgRequest,
    request: Request,
    response: Response,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_tx_session),
) -> MeResponse:
    org, membership = await service.create_org(
        session, user_id=current.user_id, name=body.name, slug=body.slug
    )
    _remint(response, request, current, org.id, OrgRole.OWNER)  # creator acts in the new org
    return await _me(session, current.user_id, org.id, OrgRole.OWNER)


@router.get("")
async def list_my_orgs(
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[OrgSummary]:
    memberships = await auth_repo.list_memberships(session, current.user_id)
    return [
        OrgSummary(
            id=m.organization.id,
            slug=m.organization.slug,
            name=m.organization.name,
            role=OrgRole(m.org_role),
        )
        for m in memberships
    ]


@router.post("/switch", dependencies=[Depends(authed_csrf)])
async def switch_org(
    body: SwitchOrgRequest,
    request: Request,
    response: Response,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> MeResponse:
    membership = await service.switch_org(
        session, user_id=current.user_id, org_id=body.organization_id
    )
    role = OrgRole(membership.org_role)
    _remint(response, request, current, body.organization_id, role)
    return await _me(session, current.user_id, body.organization_id, role)


@router.post("/invites/accept", dependencies=[Depends(authed_csrf)])
async def accept_invite(
    body: AcceptInviteRequest,
    request: Request,
    response: Response,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_tx_session),
) -> MeResponse:
    current_user = await auth_repo.get_user_by_id(session, current.user_id)
    if current_user is None:
        raise PermissionDeniedError("User not found")
    org, membership = await service.accept_invite(
        session,
        user_id=current.user_id,
        raw_token=body.token,
        current_email=current_user.email,
    )
    role = OrgRole(membership.org_role)
    _remint(response, request, current, org.id, role)
    return await _me(session, current.user_id, org.id, role)


@router.get("/active")
async def get_active_org(
    principal: Principal = Depends(require_permission(authz.ORG_READ)),
    session: AsyncSession = Depends(get_request_session),
    cache: Cache = Depends(get_cache),
) -> OrgResponse:
    key = cache_keys.org_settings_key(principal.organization_id)
    hit = await get_json(cache, key)
    if hit is not None:
        return OrgResponse(**hit)
    org = await repo.get_org(session, principal.organization_id)
    if org is None:
        raise NotFoundError("Organization not found")
    view = OrgResponse.model_validate(org)
    await set_json(cache, key, view.model_dump(mode="json"), ttl=3600)
    return view


@router.patch("/active", dependencies=[Depends(authed_csrf)])
async def update_active_org(
    body: UpdateOrgRequest,
    principal: Principal = Depends(require_permission(authz.ORG_UPDATE)),
    session: AsyncSession = Depends(get_request_session),
    cache: Cache = Depends(get_cache),
) -> OrgResponse:
    org = await service.update_org(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        name=body.name,
        timezone=body.timezone,
        branding=body.branding,
        emails_enabled=body.emails_enabled,
        in_app_notifications_enabled=body.in_app_notifications_enabled,
    )
    await get_cache().delete(cache_keys.org_settings_key(principal.organization_id))
    return OrgResponse.model_validate(org)


@router.get("/active/members")
async def list_members(
    principal: Principal = Depends(require_permission(authz.MEMBER_READ)),
    session: AsyncSession = Depends(get_request_session),
) -> list[MemberItem]:
    members = await service.list_members(session, org_id=principal.organization_id)
    return [
        MemberItem(
            user_id=m.user.id,
            email=m.user.email,
            name=m.user.name,
            role=OrgRole(m.org_role),
            joined_at=m.created_at,
        )
        for m in members
    ]


@router.patch("/active/members/{user_id}", dependencies=[Depends(authed_csrf)])
async def update_member_role(
    user_id: uuid.UUID,
    body: UpdateMemberRoleRequest,
    principal: Principal = Depends(require_permission(authz.MEMBER_ROLE_UPDATE)),
    session: AsyncSession = Depends(get_request_session),
) -> MemberItem:
    membership = await service.change_member_role(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        target_user_id=user_id,
        new_role=body.role,
    )
    user = await auth_repo.get_user_by_id(session, user_id)
    if user is None:
        raise NotFoundError("Member not found")
    return MemberItem(
        user_id=user.id,
        email=user.email,
        name=user.name,
        role=OrgRole(membership.org_role),
        joined_at=membership.created_at,
    )


@router.delete(
    "/active/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(authed_csrf)],
)
async def remove_member(
    user_id: uuid.UUID,
    principal: Principal = Depends(require_permission(authz.MEMBER_REMOVE)),
    session: AsyncSession = Depends(get_request_session),
) -> None:
    await service.remove_member(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        target_user_id=user_id,
    )


@router.post(
    "/active/invites", status_code=status.HTTP_201_CREATED, dependencies=[Depends(authed_csrf)]
)
async def create_invite(
    body: CreateInviteRequest,
    principal: Principal = Depends(require_permission(authz.MEMBER_INVITE)),
    session: AsyncSession = Depends(get_request_session),
    email_channel: EmailChannel = Depends(get_email_channel),
) -> InviteItem:
    invite, _ = await service.create_invite(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        email=body.email,
        role=body.role,
        email_channel=email_channel,
    )
    return _invite_item(invite)


@router.get("/active/invites")
async def list_invites(
    principal: Principal = Depends(require_permission(authz.MEMBER_INVITE)),
    session: AsyncSession = Depends(get_request_session),
) -> list[InviteItem]:
    invites = await service.list_invites(session, org_id=principal.organization_id)
    return [_invite_item(i) for i in invites]


@router.delete(
    "/active/invites/{invite_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(authed_csrf)],
)
async def revoke_invite(
    invite_id: uuid.UUID,
    principal: Principal = Depends(require_permission(authz.MEMBER_INVITE)),
    session: AsyncSession = Depends(get_request_session),
) -> None:
    await service.revoke_invite(
        session, org_id=principal.organization_id, actor_id=principal.user_id, invite_id=invite_id
    )
