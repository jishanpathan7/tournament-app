"""In-app notification inbox endpoints (personal — scoped to the caller).

Notifications are the caller's own (``recipient_user_id == principal.user_id``) within
the active org (RLS via ``get_request_session``), so no role permission is required —
authorization is resource ownership. Producing notifications is internal
(``service.notify``), not an HTTP endpoint.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Principal, authed_csrf, get_principal, get_request_session
from app.api.pagination import CursorPage, CursorParams, cursor_params
from app.db.models import Notification
from app.modules.notifications import service
from app.modules.notifications.schemas import (
    MarkAllReadResponse,
    NotificationResource,
    ResolveNotificationResponse,
    UnreadCountResponse,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _resource(n: Notification) -> NotificationResource:
    payload = n.payload or {}
    return NotificationResource(
        id=n.id,
        type=n.type,
        priority=n.priority,
        icon=n.icon,
        title=payload.get("title"),
        body=payload.get("body"),
        cta_label=n.cta_label,
        cta_href=n.cta_href,
        status=n.status,
        resolved_at=n.resolved_at,
        created_at=n.created_at,
    )


@router.get("", response_model=CursorPage[NotificationResource])
async def list_notifications(
    unread_only: bool = Query(default=False, alias="unreadOnly"),
    params: CursorParams = Depends(cursor_params),
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> CursorPage[NotificationResource]:
    rows, next_cursor = await service.list_for_user(
        session, user_id=principal.user_id, params=params, unread_only=unread_only
    )
    return CursorPage(items=[_resource(r) for r in rows], next_cursor=next_cursor)


@router.get("/action-required", response_model=list[NotificationResource])
async def list_action_required(
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> list[NotificationResource]:
    rows = await service.list_action_required(session, user_id=principal.user_id)
    return [_resource(r) for r in rows]


@router.get("/unread-count", response_model=UnreadCountResponse)
async def unread_count(
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> UnreadCountResponse:
    return UnreadCountResponse(count=await service.unread_count(session, user_id=principal.user_id))


@router.post(
    "/{notification_id}/read",
    response_model=NotificationResource,
    dependencies=[Depends(authed_csrf)],
)
async def mark_read(
    notification_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> NotificationResource:
    notification = await service.mark_read(
        session, user_id=principal.user_id, notification_id=notification_id
    )
    return _resource(notification)


@router.post(
    "/{notification_id}/resolve",
    response_model=ResolveNotificationResponse,
    dependencies=[Depends(authed_csrf)],
)
async def resolve_notification(
    notification_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> ResolveNotificationResponse:
    notification = await service.resolve_notification(
        session, user_id=principal.user_id, notification_id=notification_id
    )
    return ResolveNotificationResponse(id=notification.id, status=notification.status)


@router.post("/read-all", response_model=MarkAllReadResponse, dependencies=[Depends(authed_csrf)])
async def mark_all_read(
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> MarkAllReadResponse:
    updated = await service.mark_all_read(session, user_id=principal.user_id)
    return MarkAllReadResponse(updated=updated)
