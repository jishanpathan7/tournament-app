"""Public microsite use cases.

Read-only end to end — no ``session.begin()`` here, the router's ``get_public_session``
dependency owns the transaction. The one piece of real logic is ``resolve_tournament``:
look a tournament up with no org context, validate it, then set org context for its
real org so every subsequent query in the request runs under the normal, already
battle-tested org-isolation RLS policy — see ``app.modules.public.repository``.

Gating: `visibility != 'private'` gates the tournament existing at all (enforced inside
``resolve_tournament`` / ``search_tournaments``). `draw_published_at` additionally gates
anything about the actual competition (matches/standings) — an organizer can generate
and tweak a draw privately before publishing it; divisions/stages/the approved roster
are visible as soon as the tournament itself is (they're informational, not the draw).
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import NotFoundError
from app.db.models import Match, MatchResultEvent, Participant, Stage, Standing, Tournament
from app.db.session import set_org_context
from app.modules.public import repository as repo
from app.modules.scoring import repository as scoring_repo
from app.modules.tournaments import repository as tournaments_repo


async def resolve_tournament(session: AsyncSession, slug: str) -> Tournament:
    tournament = await repo.get_tournament_by_slug(session, slug)
    if tournament is None:
        raise NotFoundError("Tournament not found")
    await set_org_context(session, tournament.organization_id)
    return tournament


async def search_tournaments(session: AsyncSession, query: str) -> Sequence[Tournament]:
    q = query.strip()
    if not q:
        return []
    return await repo.search_tournaments(session, q)


async def get_sport_key(session: AsyncSession, tournament: Tournament) -> str:
    profile = await tournaments_repo.get_sport_profile(session, tournament.sport_profile_id)
    return profile.key if profile else ""


async def list_divisions_with_counts(
    session: AsyncSession, tournament: Tournament
) -> list[tuple[uuid.UUID, str, str, int | None, int]]:
    """(division_id, name, participant_type, capacity, approved_count) — a small tuple
    shape rather than the ORM row + a second lookup, since the router builds the
    response schema directly from it."""
    divisions = await tournaments_repo.list_divisions(
        session, tournament.organization_id, tournament.id
    )
    counts = await repo.division_approved_counts(
        session, tournament.organization_id, [d.id for d in divisions]
    )
    return [(d.id, d.name, d.participant_type, d.capacity, counts.get(d.id, 0)) for d in divisions]


async def list_stages_with_drawn(
    session: AsyncSession, tournament: Tournament
) -> list[tuple[Stage, bool]]:
    stages = await repo.list_stages(session, tournament.organization_id, tournament.id)
    counts = await repo.stage_match_counts(
        session, tournament.organization_id, [s.id for s in stages]
    )
    return [(s, counts.get(s.id, 0) > 0) for s in stages]


async def list_participants(session: AsyncSession, tournament: Tournament) -> Sequence[Participant]:
    return await repo.list_participants(session, tournament.organization_id, tournament.id)


async def get_participant(
    session: AsyncSession, tournament: Tournament, participant_id: uuid.UUID
) -> Participant:
    participant = await repo.get_participant(
        session, tournament.organization_id, tournament.id, participant_id
    )
    if participant is None:
        raise NotFoundError("Participant not found")
    return participant


async def list_matches(session: AsyncSession, tournament: Tournament) -> Sequence[Match]:
    if tournament.draw_published_at is None:
        return []
    return await scoring_repo.list_tournament_matches(
        session, tournament.organization_id, tournament.id
    )


async def get_match(session: AsyncSession, tournament: Tournament, match_id: uuid.UUID) -> Match:
    if tournament.draw_published_at is None:
        raise NotFoundError("Match not found")
    match = await repo.get_match(session, tournament.organization_id, tournament.id, match_id)
    if match is None:
        raise NotFoundError("Match not found")
    return match


async def list_match_events(
    session: AsyncSession, tournament: Tournament, match_id: uuid.UUID
) -> Sequence[MatchResultEvent]:
    # Confirms the match belongs to this tournament before returning its history.
    await get_match(session, tournament, match_id)
    return await scoring_repo.list_match_events(session, tournament.organization_id, match_id)


async def get_standings(
    session: AsyncSession, tournament: Tournament, stage_id: uuid.UUID
) -> Sequence[Standing]:
    if tournament.draw_published_at is None:
        return []
    stage = await repo.get_stage(session, tournament.organization_id, tournament.id, stage_id)
    if stage is None:
        raise NotFoundError("Stage not found")
    return await scoring_repo.stage_standings(session, tournament.organization_id, stage.id)
