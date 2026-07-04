"""Public scorekeeper endpoints — one match per token, no login required."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_public_session, idempotency_key
from app.api.errors import ValidationError
from app.modules.scoring import service as scoring_service
from app.modules.scoring.schemas import MatchView
from app.modules.share_links import service
from app.modules.share_links.schemas import ScorekeeperScoreRequest, ScorekeeperSessionView

router = APIRouter(prefix="/public/scorekeeper", tags=["public-scorekeeper"])


def _token(token: str | None = Query(default=None)) -> str:
    if not token or not token.strip():
        raise ValidationError("token is required", code="missing_token")
    return token.strip()


@router.get("/session", response_model=ScorekeeperSessionView)
async def get_scorekeeper_session(
    response: Response,
    token: str = Depends(_token),
    session: AsyncSession = Depends(get_public_session),
) -> ScorekeeperSessionView:
    link = await service.resolve_scorekeeper_token(session, token)
    view = await service.build_scorekeeper_session(session, link)
    match = await service.get_linked_match(session, link)
    response.headers["ETag"] = scoring_service.match_etag(match)
    return view


@router.post("/score", response_model=MatchView)
async def submit_scorekeeper_score(
    body: ScorekeeperScoreRequest,
    response: Response,
    token: str = Depends(_token),
    session: AsyncSession = Depends(get_public_session),
    if_match: str | None = Header(default=None, alias="If-Match"),
    idem_key: str | None = Depends(idempotency_key),
):
    link = await service.resolve_scorekeeper_token(session, token)
    match = await service.score_via_link(
        session,
        link=link,
        payload=body.payload,
        if_match=if_match,
        idempotency_key=idem_key,
    )
    response.headers["ETag"] = scoring_service.match_etag(match)
    return await scoring_service.build_match_view_for_org(session, link.organization_id, match)
