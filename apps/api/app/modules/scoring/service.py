"""Match scoring use cases — validate → derive (Sport Profile) → persist → advance.

Orchestrates existing engines only: the Sport Profile validates + derives the result;
the tournaments module advances the bracket; standings recompute is deferred to the
worker. Adds optimistic concurrency (ETag), idempotency, and correction handling.
Never commits — the request session owns the transaction + RLS org context.
"""

from __future__ import annotations

import datetime
import hashlib
import json
import uuid
from collections.abc import Mapping, Sequence
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ConflictError, NotFoundError, PreconditionFailedError, ValidationError
from app.core import audit
from app.core.events import emit_event
from app.core.factory import get_broadcaster, get_sport_registry
from app.db.enums import (
    ContestKind,
    IdempotencyStatus,
    MatchOutcome,
    MatchStatus,
    NotificationChannel,
)
from app.db.models import (
    IdempotencyKey,
    Match,
    MatchParticipant,
    MatchResultEvent,
    Standing,
    Tournament,
)
from app.engine import ContractError, EngineValidationError, TerminalReason
from app.modules.franchise_ties import service as franchise_ties_service
from app.modules.notifications.service import notify
from app.modules.notifications.templates import NotificationTemplate, register_template
from app.modules.scoring import events
from app.modules.scoring import repository as repo
from app.modules.scoring.schemas import (
    MatchResultEventView,
    MatchSideView,
    MatchView,
    SportMatchConfigView,
    StandingRowView,
    StandingsView,
)
from app.modules.tournaments import repository as tournaments_repo
from app.modules.tournaments import service as tournaments_service
from app.realtime.channels import org_channel, tournament_channel
from app.sports.config import merge_sport_config, sport_config_view

register_template(
    NotificationTemplate(
        type=events.NOTIFY_MATCH_COMPLETED,
        channels=(NotificationChannel.IN_APP,),
        in_app_title="Match result recorded",
        in_app_body="A match you played now has a result.",
    )
)
register_template(
    NotificationTemplate(
        type=events.NOTIFY_NEXT_MATCH_READY,
        channels=(NotificationChannel.IN_APP,),
        in_app_title="Your next match is ready",
        in_app_body="You have a match ready to play.",
    )
)

_STATUS_FOR = {
    TerminalReason.WALKOVER: MatchStatus.WALKOVER.value,
    TerminalReason.NO_SHOW: MatchStatus.NO_SHOW.value,
}


def match_etag(match: Match) -> str:
    return 'W/"%d"' % int(match.updated_at.timestamp())


def request_hash(match_id: uuid.UUID, payload: dict[str, Any]) -> str:
    body = f"{match_id}:{json.dumps(payload, sort_keys=True, separators=(',', ':'))}"
    return hashlib.sha256(body.encode()).hexdigest()


def _ordered_sides(match: Match) -> list[MatchParticipant]:
    return sorted(
        match.participants,
        key=lambda mp: (mp.seed_in_match or 0, mp.created_at, str(mp.participant_id)),
    )


def build_match_view(
    match: Match, *, sport_config: SportMatchConfigView | None = None
) -> MatchView:
    """The one place a `Match` ORM row becomes a `MatchView` — shared by the
    authenticated scoring router and the public microsite so the shape (and the
    score-against cross-referencing) never drifts between the two."""
    sides = _ordered_sides(match)
    score_by_id = {mp.participant_id: mp.score for mp in sides}
    views = []
    for mp in sides:
        other = next((o for o in sides if o.participant_id != mp.participant_id), None)
        against = score_by_id.get(other.participant_id) if other else None
        views.append(
            MatchSideView(
                participant_id=mp.participant_id,
                outcome=mp.outcome,
                score_for=int(mp.score) if mp.score is not None else None,
                score_against=int(against) if against is not None else None,
                rank=mp.rank,
            )
        )
    return MatchView(
        id=match.id,
        stage_id=match.stage_id,
        status=match.status,
        sides=views,
        result_payload=match.result_payload or {},
        round_id=match.round_id,
        round_seq=match.round.seq if match.round else None,
        round_label=match.round.label if match.round else None,
        group_id=match.group_id,
        group_name=match.group.name if match.group else None,
        court_id=match.court_id,
        scheduled_at=match.scheduled_at,
        updated_at=match.updated_at,
        sport_config=sport_config,
        parent_match_id=match.parent_match_id,
        contest_kind=match.contest_kind,
    )


def to_sport_match_config_view(config: Mapping[str, Any]) -> SportMatchConfigView:
    return SportMatchConfigView(**sport_config_view(config))


async def resolve_stage_sport_config(
    session: AsyncSession, org_id: uuid.UUID, stage_id: uuid.UUID
) -> dict[str, Any]:
    stage = await repo.get_stage(session, org_id, stage_id)
    if stage is None:
        raise NotFoundError("Stage not found")
    division = await repo.get_division(session, org_id, stage.division_id)
    if division is None:  # pragma: no cover
        raise NotFoundError("Division not found")
    tournament = await repo.get_tournament(session, org_id, division.tournament_id)
    if tournament is None:  # pragma: no cover
        raise NotFoundError("Tournament not found")
    profile = get_sport_registry().get(await _sport_key_for_tournament(session, tournament))
    return merge_sport_config(
        profile,
        tournament_settings=tournament.settings or {},
        stage_config=stage.config or {},
    )


async def resolve_match_sport_config(
    session: AsyncSession, org_id: uuid.UUID, match: Match
) -> dict[str, Any]:
    return await resolve_stage_sport_config(session, org_id, match.stage_id)


async def build_match_view_for_org(
    session: AsyncSession, org_id: uuid.UUID, match: Match
) -> MatchView:
    cfg = await resolve_match_sport_config(session, org_id, match)
    return build_match_view(match, sport_config=to_sport_match_config_view(cfg))


async def build_match_views_for_org(
    session: AsyncSession, org_id: uuid.UUID, matches: Sequence[Match]
) -> list[MatchView]:
    cache: dict[uuid.UUID, SportMatchConfigView] = {}
    views: list[MatchView] = []
    for match in matches:
        if match.stage_id not in cache:
            cfg = await resolve_stage_sport_config(session, org_id, match.stage_id)
            cache[match.stage_id] = to_sport_match_config_view(cfg)
        views.append(build_match_view(match, sport_config=cache[match.stage_id]))
    return views


def build_match_event_view(event: MatchResultEvent, *, include_actor: bool) -> MatchResultEventView:
    """`include_actor=False` for the public microsite — who scored/corrected a match
    is operational detail, never shown outside the organizer's own console."""
    return MatchResultEventView(
        id=event.id,
        match_id=event.match_id,
        type=event.type,
        payload=event.payload,
        actor_id=event.actor_id if include_actor else None,
        created_at=event.created_at,
    )


def build_standings_view(stage_id: uuid.UUID, rows: Sequence[Standing]) -> StandingsView:
    """Shared by the authenticated scoring router and the public microsite."""
    return StandingsView(
        stage_id=stage_id,
        rows=[
            StandingRowView(
                participant_id=r.participant_id,
                group_id=r.group_id,
                played=r.played,
                won=r.won,
                drawn=r.drawn,
                lost=r.lost,
                points=float(r.points),
                score_for=r.score_for,
                score_against=r.score_against,
                diff=r.score_for - r.score_against,
                rank=r.rank,
            )
            for r in rows
        ],
    )


async def start_match(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID | None,
    match_id: uuid.UUID,
    if_match: str | None = None,
) -> Match:
    """Mark a scheduled match as live — play has started on court."""
    match = await repo.get_match(session, org_id, match_id)
    if match is None:
        raise NotFoundError("Match not found")

    if if_match is not None and if_match != match_etag(match):
        raise PreconditionFailedError("Match was modified; refetch and retry", code="stale_match")

    if match.status == MatchStatus.LIVE.value:
        return match

    if match.status != MatchStatus.SCHEDULED.value:
        raise ValidationError(
            f"cannot start a match in status {match.status!r}",
            code="not_startable",
        )

    if len(_ordered_sides(match)) != 2:
        raise ValidationError("match does not have two participants to start", code="not_scorable")

    match.status = MatchStatus.LIVE.value
    await session.flush()
    # DB trigger bumps `updated_at` — refresh before router reads it for ETag / MatchView.
    await session.refresh(match, attribute_names=["updated_at"])

    audit.record(
        session,
        organization_id=org_id,
        actor_id=actor_id,
        action=events.MATCH_STARTED,
        entity="match",
        entity_id=match.id,
        after={"status": match.status},
    )
    await emit_event(
        session,
        aggregate="match",
        event_type=events.MATCH_STARTED,
        payload={
            "id": str(match.id),
            "stageId": str(match.stage_id),
            "organizationId": str(org_id),
        },
    )
    await _broadcast_started(org_id, match)
    return match


async def score_match(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID | None,
    match_id: uuid.UUID,
    payload: dict[str, Any],
    if_match: str | None,
    idempotency_key: str | None,
) -> Match:
    match = await repo.get_match(session, org_id, match_id)
    if match is None:
        raise NotFoundError("Match not found")

    if if_match is not None and if_match != match_etag(match):
        raise PreconditionFailedError("Match was modified; refetch and retry", code="stale_match")

    req_hash = request_hash(match_id, payload)
    if idempotency_key is not None:
        existing = await repo.get_idempotency(session, org_id, idempotency_key)
        if existing is not None:
            if existing.request_hash != req_hash:
                raise ConflictError(
                    "Idempotency-Key reused with a different request", code="idempotency_conflict"
                )
            if existing.status == IdempotencyStatus.STARTED.value:
                # First request is still in-flight. The caller should back off and retry.
                raise ConflictError(
                    "Score submission already in progress; retry in a moment",
                    code="idempotency_in_flight",
                )
            # status == COMPLETED: safe replay — score was fully committed.
            return match
        session.add(
            IdempotencyKey(
                organization_id=org_id,
                key=idempotency_key,
                user_id=actor_id,
                request_hash=req_hash,
                status=IdempotencyStatus.STARTED.value,
                expires_at=_now().replace(tzinfo=None) + datetime.timedelta(hours=24),
            )
        )
        await session.flush()

    sides = _ordered_sides(match)
    if len(sides) != 2:
        raise ValidationError("match does not have two participants to score", code="not_scorable")

    was_terminal = match.status in tournaments_service._TERMINAL_STATUSES
    old_winner = next(
        (mp.participant_id for mp in sides if mp.outcome == MatchOutcome.WIN.value), None
    )

    profile = get_sport_registry().get(await _sport_key(session, org_id, match))
    config = await resolve_match_sport_config(session, org_id, match)
    side_ids = [str(mp.participant_id) for mp in sides]
    try:
        profile.validate_result(payload, config)
        report = profile.derive_result(payload, config, side_participant_ids=side_ids)
    except (EngineValidationError, ContractError) as exc:
        raise ValidationError(str(exc), code="invalid_score") from exc

    # Correction guard: a winner change is unsafe once the bracket has advanced past it.
    old_winner_id = str(old_winner) if old_winner is not None else None
    if was_terminal and old_winner_id != report.outcome.winner_id:
        stage_matches = list(
            await tournaments_repo.stage_matches_with_participants(session, org_id, match.stage_id)
        )
        if tournaments_service.references_match(stage_matches, match.id):
            raise ConflictError(
                "cannot change the winner of a match that others have advanced from",
                code="correction_conflict",
            )

    # Persist the abstract per-side results + statistics onto the match.
    mp_by_id = {str(mp.participant_id): mp for mp in sides}
    for side in report.sides:
        mp = mp_by_id[side.participant_id]
        mp.outcome = side.outcome.value
        mp.score = Decimal(side.score_for)
        mp.rank = side.rank
    match.result_payload = {**payload, "statistics": report.statistics}
    match.status = _STATUS_FOR.get(report.terminal_reason, MatchStatus.COMPLETED.value)

    action = "correction" if was_terminal else report.terminal_reason.value
    session.add(
        MatchResultEvent(
            organization_id=org_id,
            match_id=match.id,
            actor_id=actor_id,
            type=action,
            payload=payload,
        )
    )
    await session.flush()

    # Advance the bracket (winner_of / bye progression + pending → scheduled).
    stage = await repo.get_stage(session, org_id, match.stage_id)
    advancement = await tournaments_service.resolve_bracket(session, org_id, stage) if stage else {}

    if idempotency_key is not None:
        idem = await repo.get_idempotency(session, org_id, idempotency_key)
        if idem is not None:
            idem.status = IdempotencyStatus.COMPLETED.value
            idem.response_snapshot = {"matchId": str(match.id), "status": match.status}

    await _emit(session, org_id, actor_id, match, was_terminal)
    if match.contest_kind == ContestKind.LEG.value and match.parent_match_id:
        tie_decided = await franchise_ties_service.rollup_leg_to_tie(
            session, org_id=org_id, leg_match=match
        )
        if tie_decided:
            await emit_event(
                session,
                aggregate="standings",
                event_type=events.STANDINGS_RECOMPUTE,
                payload={"stageId": str(match.stage_id), "organizationId": str(org_id)},
            )
    await _broadcast(org_id, match)
    await _notify(session, org_id, match, advancement.get("scheduled", []))

    # Auto-schedule: when enabled and a court is now free, assign next waiting match.
    freed_court_id = match.court_id
    if freed_court_id is not None and not was_terminal:
        tournament_row = await repo.get_tournament(session, org_id, match.tournament_id)
        if tournament_row is not None and tournament_row.settings.get("auto_schedule"):
            from app.modules.scheduling import service as scheduling_service  # noqa: PLC0415

            await scheduling_service.auto_schedule_next(
                session,
                org_id=org_id,
                actor_id=actor_id,
                tournament=tournament_row,
                freed_court_id=freed_court_id,
            )

    return match


async def _emit(
    session: AsyncSession,
    org_id: uuid.UUID,
    actor_id: uuid.UUID | None,
    match: Match,
    was_terminal: bool,
) -> None:
    action = events.MATCH_CORRECTED if was_terminal else events.MATCH_COMPLETED
    audit.record(
        session,
        organization_id=org_id,
        actor_id=actor_id,
        action=action,
        entity="match",
        entity_id=match.id,
        after={"status": match.status},
    )
    await emit_event(
        session,
        aggregate="match",
        event_type=action,
        payload={
            "id": str(match.id),
            "stageId": str(match.stage_id),
            "organizationId": str(org_id),
        },
    )
    # Trigger asynchronous standings recomputation (idempotent, worker-serialized).
    await emit_event(
        session,
        aggregate="standings",
        event_type=events.STANDINGS_RECOMPUTE,
        payload={"stageId": str(match.stage_id), "organizationId": str(org_id)},
    )


async def _broadcast_started(org_id: uuid.UUID, match: Match) -> None:
    broadcaster = get_broadcaster()
    match_data = {
        "tournamentId": str(match.tournament_id),
        "matchId": str(match.id),
        "stageId": str(match.stage_id),
        "status": match.status,
    }
    for channel in (org_channel(org_id), tournament_channel(match.tournament_id)):
        await broadcaster.publish(channel, events.RT_MATCH_STARTED, match_data)


async def _broadcast(org_id: uuid.UUID, match: Match) -> None:
    broadcaster = get_broadcaster()
    org = org_channel(org_id)
    # Also fan out to the tournament's own channel — the public microsite's anonymous
    # viewers subscribe to this one, never to the org channel (see `channels.py`).
    tournament = tournament_channel(match.tournament_id)
    match_data = {
        "tournamentId": str(match.tournament_id),
        "matchId": str(match.id),
        "status": match.status,
    }
    bracket_data = {"tournamentId": str(match.tournament_id), "stageId": str(match.stage_id)}
    for channel in (org, tournament):
        await broadcaster.publish(channel, events.RT_MATCH_COMPLETED, match_data)
        await broadcaster.publish(channel, events.RT_BRACKET_UPDATED, bracket_data)


async def _notify(
    session: AsyncSession, org_id: uuid.UUID, match: Match, scheduled_ids: list[str]
) -> None:
    for mp in match.participants:
        user_id = await participant_user(session, org_id, mp.participant_id)
        if user_id is not None:
            await notify(
                session,
                organization_id=org_id,
                recipient_user_id=user_id,
                type=events.NOTIFY_MATCH_COMPLETED,
                data={"matchId": str(match.id), "tournamentId": str(match.tournament_id)},
            )
    for match_id in scheduled_ids:
        ready = await repo.get_match(session, org_id, uuid.UUID(match_id))
        if ready is None:
            continue
        for mp in ready.participants:
            user_id = await participant_user(session, org_id, mp.participant_id)
            if user_id is not None:
                await notify(
                    session,
                    organization_id=org_id,
                    recipient_user_id=user_id,
                    type=events.NOTIFY_NEXT_MATCH_READY,
                    data={"matchId": match_id, "tournamentId": str(match.tournament_id)},
                )


async def participant_user(
    session: AsyncSession, org_id: uuid.UUID, participant_id: uuid.UUID
) -> uuid.UUID | None:
    participant = await repo.get_participant(session, org_id, participant_id)
    if participant is None:
        return None
    if participant.user_id is not None:
        return participant.user_id
    if participant.team_id is not None:
        team = await repo.get_team(session, org_id, participant.team_id)
        return team.captain_user_id if team else None
    return None


async def _sport_key_for_tournament(session: AsyncSession, tournament: Tournament) -> str:
    sport_profile = await repo.get_sport_profile(session, tournament.sport_profile_id)
    if sport_profile is None:  # pragma: no cover
        raise NotFoundError("Sport profile not found")
    return sport_profile.key


async def _sport_key(session: AsyncSession, org_id: uuid.UUID, match: Match) -> str:
    stage = await repo.get_stage(session, org_id, match.stage_id)
    if stage is None:  # pragma: no cover
        raise NotFoundError("Stage not found")
    division = await repo.get_division(session, org_id, stage.division_id)
    if division is None:  # pragma: no cover
        raise NotFoundError("Division not found")
    tournament = await repo.get_tournament(session, org_id, division.tournament_id)
    if tournament is None:  # pragma: no cover
        raise NotFoundError("Tournament not found")
    return await _sport_key_for_tournament(session, tournament)


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)
