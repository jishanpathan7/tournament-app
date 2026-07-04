"""Public self check-in — division roster via revocable token."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_public_session
from app.api.errors import ValidationError
from app.modules.share_links import service
from app.modules.share_links.schemas import CheckInSessionView, PublicCheckInRequest

router = APIRouter(prefix="/public/checkin", tags=["public-checkin"])


def _token(token: str | None = Query(default=None)) -> str:
    if not token or not token.strip():
        raise ValidationError("token is required", code="missing_token")
    return token.strip()


@router.get("/session", response_model=CheckInSessionView)
async def get_checkin_session(
    token: str = Depends(_token),
    session: AsyncSession = Depends(get_public_session),
) -> CheckInSessionView:
    link = await service.resolve_checkin_token(session, token)
    return await service.build_checkin_session(session, link)


@router.post("/confirm", status_code=204)
async def confirm_checkin(
    body: PublicCheckInRequest,
    token: str = Depends(_token),
    session: AsyncSession = Depends(get_public_session),
) -> None:
    link = await service.resolve_checkin_token(session, token)
    await service.checkin_via_link(session, link=link, participant_id=body.participant_id)
