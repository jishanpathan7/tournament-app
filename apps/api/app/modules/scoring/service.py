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
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ConflictError, NotFoundError, PreconditionFailedError, ValidationError
from app.core import audit
from app.core.events import emit_event
from app.core.factory import get_broadcaster, get_sport_registry
from app.db.enums import IdempotencyStatus, MatchOutcome, MatchStatus, NotificationChannel
from app.db.models import IdempotencyKey, Match, MatchParticipant, MatchResultEvent
from app.engine import ContractError, EngineValidationError, TerminalReason
from app.modules.notifications.service import notify
from app.modules.notifications.templates import NotificationTemplate, register_template
from app.modules.scoring import events
from app.modules.scoring import repository as repo
from app.modules.tournaments import repository as tournaments_repo
from app.modules.tournaments import service as tournaments_service
from app.realtime.channels import org_channel

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


async def score_match(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
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
            return match  # replay: the score was already applied; return current state
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
    config = profile.default_config()
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
    await _broadcast(org_id, match)
    await _notify(session, org_id, match, advancement.get("scheduled", []))
    return match


async def _emit(
    session: AsyncSession, org_id: uuid.UUID, actor_id: uuid.UUID, match: Match, was_terminal: bool
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


async def _broadcast(org_id: uuid.UUID, match: Match) -> None:
    broadcaster = get_broadcaster()
    channel = org_channel(org_id)
    data = {
        "tournamentId": str(match.tournament_id),
        "matchId": str(match.id),
        "status": match.status,
    }
    await broadcaster.publish(channel, events.RT_MATCH_COMPLETED, data)
    await broadcaster.publish(
        channel,
        events.RT_BRACKET_UPDATED,
        {"tournamentId": str(match.tournament_id), "stageId": str(match.stage_id)},
    )


async def _notify(
    session: AsyncSession, org_id: uuid.UUID, match: Match, scheduled_ids: list[str]
) -> None:
    for mp in match.participants:
        user_id = await _participant_user(session, org_id, mp.participant_id)
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
            user_id = await _participant_user(session, org_id, mp.participant_id)
            if user_id is not None:
                await notify(
                    session,
                    organization_id=org_id,
                    recipient_user_id=user_id,
                    type=events.NOTIFY_NEXT_MATCH_READY,
                    data={"matchId": match_id, "tournamentId": str(match.tournament_id)},
                )


async def _participant_user(
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
    profile = await repo.get_sport_profile(session, tournament.sport_profile_id)
    if profile is None:  # pragma: no cover
        raise NotFoundError("Sport profile not found")
    return profile.key


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)
