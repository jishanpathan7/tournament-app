"""Participant portal endpoints — authenticated user across all org memberships."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user, get_tx_session
from app.modules.me import service
from app.modules.me.schemas import PortalHomeView

router = APIRouter(prefix="/me", tags=["me"])


@router.get("/portal", response_model=PortalHomeView)
async def get_portal_home(
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_tx_session),
) -> PortalHomeView:
    return await service.get_portal_home(session, current.user_id)
