"""Public microsite HTTP endpoints — no auth, no CSRF (read-only).

Every route is nested under ``/public/tournaments/{slug}`` (or is the top-level search)
so `service.resolve_tournament` always runs first: it's what turns an anonymous
request into one with a verified, real org context. Match/standings/event shapes are
built through the same `scoring.service` helpers the authenticated router uses, so the
wire format never drifts between the two surfaces.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response

from app.api.deps import get_public_session
from app.cache import get_json
from app.cache import keys as cache_keys
from app.cache import set_json
from app.core.config import get_settings
from app.core.factory import get_broadcaster, get_cache, get_connection_manager, get_transport
from app.core.limiter import limiter
from app.core.ports import Cache
from app.db.models import Tournament
from app.modules.public import service
from app.modules.public.schemas import (
    PlayerStatsView,
    PublicDivisionView,
    PublicOrgView,
    PublicParticipantView,
    PublicRegistrationSubmittedView,
    PublicStageView,
    PublicSubmitRegistrationRequest,
    PublicTournamentSearchResult,
    PublicTournamentView,
    PublicVenueView,
)
from app.modules.scheduling import service as scheduling_service
from app.modules.scheduling.schemas import ScheduleQueueView
from app.modules.scoring import service as scoring_service
from app.modules.scoring.schemas import MatchResultEventView, MatchView, StandingsView
from app.realtime.channels import tournament_channel

router = APIRouter(prefix="/public", tags=["public"])


def _tournament_view(tournament: Tournament, sport_key: str) -> PublicTournamentView:
    return PublicTournamentView(
        id=tournament.id,
        slug=tournament.slug,
        name=tournament.name,
        sport_key=sport_key,
        status=tournament.status,
        visibility=tournament.visibility,
        starts_at=tournament.starts_at,
        ends_at=tournament.ends_at,
        venue_name=(
            tournament.venue.name if tournament.venue else tournament.settings.get("venue_name")
        ),
        venue=(
            PublicVenueView(
                name=tournament.venue.name,
                address=tournament.venue.address,
                maps_url=tournament.venue.maps_url,
            )
            if tournament.venue
            else None
        ),
        draw_published_at=tournament.draw_published_at,
        schedule_published_at=tournament.schedule_published_at,
        results_published_at=tournament.results_published_at,
        organization=PublicOrgView(
            slug=tournament.organization.slug,
            name=tournament.organization.name,
            branding=tournament.organization.branding,
        ),
    )


@router.get("/search", response_model=list[PublicTournamentSearchResult])
@limiter.limit("30/minute")
async def search_tournaments(
    request: Request,
    q: str = Query(..., min_length=1, max_length=200),
    session: AsyncSession = Depends(get_public_session),
) -> list[PublicTournamentSearchResult]:
    rows = await service.search_tournaments(session, q)
    return [
        PublicTournamentSearchResult(
            slug=t.slug,
            name=t.name,
            sport_key=await service.get_sport_key(session, t),
            status=t.status,
            organization_name=t.organization.name,
            organization_slug=t.organization.slug,
        )
        for t in rows
    ]


@router.get("/tournaments/{slug}", response_model=PublicTournamentView)
async def get_tournament(
    slug: str,
    session: AsyncSession = Depends(get_public_session),
    cache: Cache = Depends(get_cache),
) -> PublicTournamentView:
    tournament = await service.resolve_tournament(session, slug)
    key = cache_keys.public_tournament_keys(tournament.id)["overview"]
    hit = await get_json(cache, key)
    if hit is not None:
        return PublicTournamentView(**hit)
    sport_key = await service.get_sport_key(session, tournament)
    view = _tournament_view(tournament, sport_key)
    await set_json(cache, key, view.model_dump(mode="json"), ttl=300)
    return view


@router.get("/tournaments/{slug}/divisions", response_model=list[PublicDivisionView])
async def list_divisions(
    slug: str,
    session: AsyncSession = Depends(get_public_session),
    cache: Cache = Depends(get_cache),
) -> list[PublicDivisionView]:
    tournament = await service.resolve_tournament(session, slug)
    key = cache_keys.public_tournament_keys(tournament.id)["divisions"]
    hit = await get_json(cache, key)
    if hit is not None:
        return [PublicDivisionView(**row) for row in hit]
    rows = await service.list_divisions_with_counts(session, tournament)
    views = [
        PublicDivisionView(
            id=did, name=name, participant_type=ptype, capacity=capacity, approved_count=count
        )
        for did, name, ptype, capacity, count in rows
    ]
    await set_json(cache, key, [v.model_dump(mode="json") for v in views], ttl=300)
    return views


@router.post(
    "/tournaments/{slug}/divisions/{division_id}/registrations",
    response_model=PublicRegistrationSubmittedView,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("5/minute")
async def submit_registration(
    slug: str,
    division_id: uuid.UUID,
    body: PublicSubmitRegistrationRequest,
    request: Request,
    session: AsyncSession = Depends(get_public_session),
) -> PublicRegistrationSubmittedView:
    tournament = await service.resolve_tournament(session, slug)
    registration = await service.submit_registration(
        session,
        tournament=tournament,
        division_id=division_id,
        name=body.name,
        email=body.email,
        skill_level=body.skill_level,
        preferred_partner_name=body.preferred_partner_name,
    )
    return PublicRegistrationSubmittedView(
        id=registration.id,
        status=registration.status,
        division_id=registration.division_id,
    )


@router.get("/tournaments/{slug}/stages", response_model=list[PublicStageView])
async def list_stages(
    slug: str,
    session: AsyncSession = Depends(get_public_session),
    cache: Cache = Depends(get_cache),
) -> list[PublicStageView]:
    tournament = await service.resolve_tournament(session, slug)
    key = cache_keys.public_tournament_keys(tournament.id)["stages"]
    hit = await get_json(cache, key)
    if hit is not None:
        return [PublicStageView(**row) for row in hit]
    rows = await service.list_stages_with_drawn(session, tournament)
    views = [
        PublicStageView(id=s.id, division_id=s.division_id, type=s.type, seq=s.seq, drawn=drawn)
        for s, drawn in rows
    ]
    await set_json(cache, key, [v.model_dump(mode="json") for v in views], ttl=300)
    return views


@router.get("/tournaments/{slug}/participants", response_model=list[PublicParticipantView])
async def list_participants(
    slug: str,
    session: AsyncSession = Depends(get_public_session),
    cache: Cache = Depends(get_cache),
) -> list[PublicParticipantView]:
    tournament = await service.resolve_tournament(session, slug)
    key = cache_keys.public_tournament_keys(tournament.id)["participants"]
    hit = await get_json(cache, key)
    if hit is not None:
        return [PublicParticipantView(**row) for row in hit]
    rows = await service.list_participants(session, tournament)
    views = [
        PublicParticipantView(
            id=p.id,
            division_id=p.division_id,
            kind=p.kind,
            display_name=p.display_name,
            seed=p.seed,
            team_name=p.team.squad.name if p.team and p.team.squad else None,
        )
        for p in rows
    ]
    await set_json(cache, key, [v.model_dump(mode="json") for v in views], ttl=300)
    return views


@router.get(
    "/tournaments/{slug}/participants/{participant_id}", response_model=PublicParticipantView
)
async def get_participant(
    slug: str, participant_id: uuid.UUID, session: AsyncSession = Depends(get_public_session)
) -> PublicParticipantView:
    tournament = await service.resolve_tournament(session, slug)
    p = await service.get_participant(session, tournament, participant_id)
    return PublicParticipantView(
        id=p.id,
        division_id=p.division_id,
        kind=p.kind,
        display_name=p.display_name,
        seed=p.seed,
        team_name=p.team.squad.name if p.team and p.team.squad else None,
    )


@router.get("/tournaments/{slug}/player-stats", response_model=PlayerStatsView)
async def get_player_stats(
    slug: str, session: AsyncSession = Depends(get_public_session)
) -> PlayerStatsView:
    tournament = await service.resolve_tournament(session, slug)
    return await service.get_player_stats(session, tournament)


@router.get("/tournaments/{slug}/courts", response_model=ScheduleQueueView)
async def get_courts(
    slug: str,
    session: AsyncSession = Depends(get_public_session),
    cache: Cache = Depends(get_cache),
) -> ScheduleQueueView:
    tournament = await service.resolve_tournament(session, slug)
    key = cache_keys.public_tournament_keys(tournament.id)["schedule"]
    hit = await get_json(cache, key)
    if hit is not None:
        return ScheduleQueueView(**hit)
    view = await scheduling_service.build_queue(session, tournament.organization_id, tournament.id)
    await set_json(cache, key, view.model_dump(mode="json"), ttl=60)
    return view


@router.get("/tournaments/{slug}/matches", response_model=list[MatchView])
async def list_matches(
    slug: str, session: AsyncSession = Depends(get_public_session)
) -> list[MatchView]:
    tournament = await service.resolve_tournament(session, slug)
    rows = await service.list_matches(session, tournament)
    return [
        service.redact_unpublished_schedule(tournament, scoring_service.build_match_view(m))
        for m in rows
    ]


@router.get("/tournaments/{slug}/matches/{match_id}", response_model=MatchView)
async def get_match(
    slug: str, match_id: uuid.UUID, session: AsyncSession = Depends(get_public_session)
) -> MatchView:
    tournament = await service.resolve_tournament(session, slug)
    match = await service.get_match(session, tournament, match_id)
    return service.redact_unpublished_schedule(tournament, scoring_service.build_match_view(match))


@router.get(
    "/tournaments/{slug}/matches/{match_id}/events", response_model=list[MatchResultEventView]
)
async def list_match_events(
    slug: str, match_id: uuid.UUID, session: AsyncSession = Depends(get_public_session)
) -> list[MatchResultEventView]:
    tournament = await service.resolve_tournament(session, slug)
    rows = await service.list_match_events(session, tournament, match_id)
    return [scoring_service.build_match_event_view(e, include_actor=False) for e in rows]


@router.get("/tournaments/{slug}/stages/{stage_id}/standings", response_model=StandingsView)
async def get_standings(
    slug: str,
    stage_id: uuid.UUID,
    session: AsyncSession = Depends(get_public_session),
    cache: Cache = Depends(get_cache),
) -> StandingsView:
    tournament = await service.resolve_tournament(session, slug)
    key = cache_keys.public_standings_key(tournament.id, stage_id)
    hit = await get_json(cache, key)
    if hit is not None:
        return StandingsView(**hit)
    rows = await service.get_standings(session, tournament, stage_id)
    view = scoring_service.build_standings_view(stage_id, rows)
    await set_json(cache, key, view.model_dump(mode="json"), ttl=30)
    return view


@router.get("/tournaments/{slug}/stream")
async def stream(slug: str, session: AsyncSession = Depends(get_public_session)) -> Response:
    """Anonymous SSE subscription to this tournament's own channel — never the org
    channel. Re-validates visibility the same way every other public read does; no
    principal, no `is_authorized` (that's the authenticated-only gate)."""
    tournament = await service.resolve_tournament(session, slug)
    channel = tournament_channel(tournament.id)

    broadcaster = get_broadcaster()
    connections = get_connection_manager()
    transport = get_transport()

    async def events() -> AsyncIterator[dict[str, Any]]:
        with connections.track(channel):
            async for event in broadcaster.subscribe(channel):
                yield event

    return transport.response(events(), ping=get_settings().realtime_ping_interval)
