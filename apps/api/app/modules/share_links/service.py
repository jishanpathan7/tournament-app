"""Share-link use cases — one revocable public link per match for court-side scoring."""

from __future__ import annotations

import datetime
import secrets
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import NotFoundError, PermissionDeniedError, ValidationError
from app.core import audit
from app.core.config import get_settings
from app.core.security import hash_token
from app.db.enums import ShareLinkScope
from app.db.models import Court, Match, Participant, ShareLink, Tournament
from app.db.session import set_org_context
from app.modules.scoring import repository as scoring_repo
from app.modules.scoring import service as scoring_service
from app.modules.share_links import events
from app.modules.share_links import repository as repo
from app.modules.share_links.schemas import (
    CheckInLinkView,
    CheckInSessionView,
    ScorekeeperLinkView,
    ScorekeeperMatchCardView,
    ScorekeeperSessionView,
)


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def _utc_naive() -> datetime.datetime:
    """Naive UTC for TIMESTAMP WITHOUT TIME ZONE columns."""
    return _now().replace(tzinfo=None)


def _new_shortcode() -> str:
    return secrets.token_urlsafe(8)[:12]


def scorekeeper_url(raw_token: str) -> str:
    base = get_settings().frontend_url.rstrip("/")
    return f"{base}/scorekeeper/{raw_token}"


def link_view(link: ShareLink, *, url: str | None = None) -> ScorekeeperLinkView:
    return ScorekeeperLinkView(
        id=link.id,
        match_id=link.match_id,  # type: ignore[arg-type]
        tournament_id=link.tournament_id,  # type: ignore[arg-type]
        expires_at=link.expires_at,
        revoked=link.revoked,
        url=url,
    )


async def resolve_scorekeeper_token(session: AsyncSession, raw_token: str) -> ShareLink:
    link = await repo.get_by_token_hash(session, hash_token(raw_token))
    if link is None:
        raise PermissionDeniedError("Invalid or expired scorekeeper link", code="invalid_link")
    if link.revoked:
        raise PermissionDeniedError("This scorekeeper link has been revoked", code="link_revoked")
    if (
        link.scope != ShareLinkScope.SCOREKEEPER.value
        or link.tournament_id is None
        or link.match_id is None
    ):
        raise PermissionDeniedError("Invalid scorekeeper link", code="invalid_link")
    if link.expires_at is not None and link.expires_at < _utc_naive():
        raise PermissionDeniedError("This scorekeeper link has expired", code="link_expired")
    await set_org_context(session, link.organization_id)
    return link


async def create_match_scorekeeper_link(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    match_id: uuid.UUID,
    expires_in_hours: int,
    recipient_email: str | None = None,
    recipient_name: str | None = None,
) -> tuple[ShareLink, str]:
    match = await scoring_repo.get_match(session, org_id, match_id)
    if match is None:
        raise NotFoundError("Match not found")
    sides = scoring_service._ordered_sides(match)
    if len(sides) < 2:
        raise ValidationError("match is not ready to score", code="not_scorable")

    for existing in await repo.list_match_scorekeeper_links(session, org_id, match_id):
        if not existing.revoked:
            existing.revoked = True

    raw = secrets.token_urlsafe(32)
    link = ShareLink(
        organization_id=org_id,
        tournament_id=match.tournament_id,
        match_id=match_id,
        scope=ShareLinkScope.SCOREKEEPER.value,
        shortcode=_new_shortcode(),
        token_hash=hash_token(raw),
        recipient_email=recipient_email,
        recipient_name=recipient_name,
        created_by=actor_id,
        expires_at=_utc_naive() + datetime.timedelta(hours=expires_in_hours),
        revoked=False,
    )
    session.add(link)
    await session.flush()

    url = scorekeeper_url(raw)
    if recipient_email:
        from app.modules.notifications.email_queue import queue_email

        tournament = await session.get(Tournament, match.tournament_id)
        await queue_email(
            session,
            to=recipient_email,
            template="scorekeeper_invite",
            data={
                "name": recipient_name or "Scorekeeper",
                "tournament_name": tournament.name if tournament else "Tournament",
                "url": url,
            },
            organization_id=org_id,
        )

    audit.record(
        session,
        organization_id=org_id,
        actor_id=actor_id,
        action=events.SCOREKEEPER_LINK_CREATED,
        entity="share_link",
        entity_id=link.id,
        after={"matchId": str(match_id), "tournamentId": str(match.tournament_id)},
    )
    return link, raw


async def get_match_scorekeeper_link(
    session: AsyncSession, *, org_id: uuid.UUID, match_id: uuid.UUID
) -> ScorekeeperLinkView | None:
    link = await repo.get_active_match_scorekeeper_link(session, org_id, match_id)
    if link is None:
        return None
    return link_view(link)


async def revoke_match_scorekeeper_link(
    session: AsyncSession, *, org_id: uuid.UUID, actor_id: uuid.UUID, match_id: uuid.UUID
) -> None:
    link = await repo.get_active_match_scorekeeper_link(session, org_id, match_id)
    if link is None:
        raise NotFoundError("No active scorekeeper link for this match")
    link.revoked = True
    await session.flush()
    audit.record(
        session,
        organization_id=org_id,
        actor_id=actor_id,
        action=events.SCOREKEEPER_LINK_REVOKED,
        entity="share_link",
        entity_id=link.id,
    )


async def _side_labels(session: AsyncSession, match: Match) -> list[str]:
    labels: list[str] = []
    for mp in scoring_service._ordered_sides(match):
        participant = await session.get(Participant, mp.participant_id)
        labels.append(participant.display_name if participant else "Unknown")
    return labels


async def _match_card(session: AsyncSession, match: Match) -> ScorekeeperMatchCardView:
    court_name: str | None = None
    if match.court_id is not None:
        court = await session.get(Court, match.court_id)
        court_name = court.name if court else None
    return ScorekeeperMatchCardView(
        match_id=match.id,
        side_labels=await _side_labels(session, match),
        match_status=match.status,
        round_label=match.round.label if match.round else None,
        court_id=match.court_id,
        court_name=court_name,
        scheduled_at=match.scheduled_at,
        group_name=match.group.name if match.group else None,
    )


async def get_linked_match(session: AsyncSession, link: ShareLink) -> Match:
    if link.match_id is None:
        raise PermissionDeniedError("Invalid scorekeeper link", code="invalid_link")
    match = await scoring_repo.get_match(session, link.organization_id, link.match_id)
    if match is None or match.tournament_id != link.tournament_id:
        raise NotFoundError("Match not found")
    sides = scoring_service._ordered_sides(match)
    if len(sides) < 2:
        raise ValidationError("match is not ready to score", code="not_scorable")
    return match


async def build_scorekeeper_session(
    session: AsyncSession, link: ShareLink
) -> ScorekeeperSessionView:
    match = await get_linked_match(session, link)
    tournament = await session.get(Tournament, link.tournament_id)
    if tournament is None:
        raise NotFoundError("Tournament not found")
    sport_cfg = await scoring_service.resolve_match_sport_config(
        session, link.organization_id, match
    )
    return ScorekeeperSessionView(
        tournament_id=tournament.id,
        tournament_name=tournament.name,
        match=await _match_card(session, match),
        sport_config=scoring_service.to_sport_match_config_view(sport_cfg),
    )


async def score_via_link(
    session: AsyncSession,
    *,
    link: ShareLink,
    payload: dict,
    if_match: str | None,
    idempotency_key: str | None,
) -> Match:
    match = await get_linked_match(session, link)
    return await scoring_service.score_match(
        session,
        org_id=link.organization_id,
        actor_id=None,
        match_id=match.id,
        payload=payload,
        if_match=if_match,
        idempotency_key=idempotency_key,
    )


def checkin_url(raw_token: str) -> str:
    base = get_settings().frontend_url.rstrip("/")
    return f"{base}/checkin/{raw_token}"


async def create_division_checkin_link(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    division_id: uuid.UUID,
    expires_in_hours: int,
) -> tuple[ShareLink, str]:
    from app.db.models import Division

    division = await session.get(Division, division_id)
    if division is None or division.organization_id != org_id:
        raise NotFoundError("Division not found")

    for existing in await repo.list_division_checkin_links(session, org_id, division_id):
        if not existing.revoked:
            existing.revoked = True

    raw = secrets.token_urlsafe(32)
    link = ShareLink(
        organization_id=org_id,
        tournament_id=division.tournament_id,
        division_id=division_id,
        scope=ShareLinkScope.CHECK_IN.value,
        shortcode=_new_shortcode(),
        token_hash=hash_token(raw),
        created_by=actor_id,
        expires_at=_utc_naive() + datetime.timedelta(hours=expires_in_hours),
        revoked=False,
    )
    session.add(link)
    await session.flush()
    return link, raw


async def get_division_checkin_link(
    session: AsyncSession, *, org_id: uuid.UUID, division_id: uuid.UUID
) -> CheckInLinkView | None:
    link = await repo.get_active_division_checkin_link(session, org_id, division_id)
    if link is None:
        return None
    return CheckInLinkView(
        id=link.id,
        division_id=link.division_id,  # type: ignore[arg-type]
        tournament_id=link.tournament_id,  # type: ignore[arg-type]
        expires_at=link.expires_at,
        revoked=link.revoked,
    )


async def resolve_checkin_token(session: AsyncSession, raw_token: str) -> ShareLink:
    link = await repo.get_by_token_hash(session, hash_token(raw_token))
    if link is None:
        raise PermissionDeniedError("Invalid or expired check-in link", code="invalid_link")
    if link.revoked:
        raise PermissionDeniedError("This check-in link has been revoked", code="link_revoked")
    if link.scope != ShareLinkScope.CHECK_IN.value or link.division_id is None:
        raise PermissionDeniedError("Invalid check-in link", code="invalid_link")
    if link.expires_at is not None and link.expires_at < _utc_naive():
        raise PermissionDeniedError("This check-in link has expired", code="link_expired")
    await set_org_context(session, link.organization_id)
    return link


async def build_checkin_session(session: AsyncSession, link: ShareLink) -> CheckInSessionView:
    from app.db.models import Division
    from app.modules.registration_ops import checkin_service
    from app.modules.share_links.schemas import CheckInParticipantView

    division = await session.get(Division, link.division_id)
    tournament = await session.get(Tournament, link.tournament_id)
    if division is None or tournament is None:
        raise NotFoundError("Division not found")

    roster = await checkin_service.list_attendance(session, link.organization_id, division.id)
    participants = [
        CheckInParticipantView(id=p.id, display_name=p.display_name, attendance=p.attendance)
        for p in roster
    ]
    return CheckInSessionView(
        tournament_id=tournament.id,
        tournament_name=tournament.name,
        division_id=division.id,
        division_name=division.name,
        participants=participants,
    )


async def checkin_via_link(
    session: AsyncSession, *, link: ShareLink, participant_id: uuid.UUID
) -> None:
    from app.db.enums import AttendanceStatus
    from app.modules.registration_ops import checkin_service
    from app.modules.registration_ops import repository as reg_repo

    if link.division_id is None:
        raise PermissionDeniedError("Invalid check-in link", code="invalid_link")
    participant = await reg_repo.get_participant(session, link.organization_id, participant_id)
    if participant is None:
        raise NotFoundError("Participant not found")
    if participant.division_id != link.division_id:
        raise ValidationError("Participant is not in this division", code="wrong_division")
    await checkin_service.set_attendance(
        session,
        org_id=link.organization_id,
        actor_id=link.created_by or link.organization_id,
        participant_id=participant_id,
        status=AttendanceStatus.CHECKED_IN.value,
    )
