"""Background job handlers for scoring — asynchronous standings recomputation.

Triggered by the ``standings.recompute`` outbox event on match completion. Runs in the
worker (org context set from the payload), serialized per stage by a Postgres advisory
lock, and fully recomputes the stage's standings from completed matches only via the
pure StandingsEngine (deterministic). Emits ``standings.recomputed`` + a realtime update.
"""

from __future__ import annotations

import datetime
import uuid
from decimal import Decimal

from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.events import emit_event
from app.core.factory import get_broadcaster, get_sport_registry, get_standings_engine
from app.db.enums import ContestKind, MatchStatus, ParticipantKind, ParticipantStatus
from app.db.models import (
    Division,
    Group,
    Match,
    Participant,
    PointsRule,
    SportProfile,
    Stage,
    Standing,
    TiebreakRuleset,
    Tournament,
)
from app.engine import (
    MatchResult,
    ParticipantRef,
    PointsPolicy,
    SideOutcome,
    SideResult,
    StandingsRequest,
    TerminalReason,
    TiebreakPolicy,
)
from app.modules.scoring import events
from app.realtime.channels import org_channel, tournament_channel
from app.workers.registry import JobContext, handler

_TERMINAL = {MatchStatus.COMPLETED.value, MatchStatus.WALKOVER.value, MatchStatus.NO_SHOW.value}
_STATUS_REASON = {
    MatchStatus.WALKOVER.value: TerminalReason.WALKOVER,
    MatchStatus.NO_SHOW.value: TerminalReason.NO_SHOW,
}


@handler(events.STANDINGS_RECOMPUTE)
async def recompute_standings(payload: dict, ctx: JobContext) -> None:
    session = ctx.session
    stage_id = uuid.UUID(payload["stageId"])
    org_id = uuid.UUID(payload["organizationId"])

    # Serialize concurrent recomputes for the same stage without table locks.
    await session.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:key))"), {"key": f"standings:{stage_id}"}
    )
    stage = await session.get(Stage, stage_id)
    if stage is None:
        return

    points = await _points_policy(session, stage)
    tiebreak = TiebreakPolicy(criteria=await _tiebreak_criteria(session, stage))
    engine = get_standings_engine()

    matches = (
        (
            await session.execute(
                select(Match)
                .where(Match.stage_id == stage_id)
                .options(selectinload(Match.participants))
            )
        )
        .scalars()
        .all()
    )
    franchise_mode = bool((stage.config or {}).get("franchiseMode"))
    if franchise_mode:
        completed = [
            m
            for m in matches
            if m.contest_kind == ContestKind.TIE.value
            and m.status in _TERMINAL
            and len(m.participants) == 2
            and all(p.outcome for p in m.participants)
        ]
        participant_ids = [
            str(p.id)
            for p in (
                await session.execute(
                    select(Participant).where(
                        Participant.division_id == stage.division_id,
                        Participant.kind == ParticipantKind.SQUAD.value,
                    )
                )
            )
            .scalars()
            .all()
        ]
    else:
        # completed 2-sided matches only (byes/pending are excluded from standings)
        completed = [
            m
            for m in matches
            if m.contest_kind == ContestKind.STANDARD.value
            and m.status in _TERMINAL
            and len(m.participants) == 2
            and all(p.outcome for p in m.participants)
        ]
        participant_ids = await _division_participant_ids(session, stage.division_id)
    groups = (
        (await session.execute(select(Group).where(Group.stage_id == stage_id))).scalars().all()
    )

    await session.execute(delete(Standing).where(Standing.stage_id == stage_id))

    scopes: list[tuple[uuid.UUID | None, list[Match]]]
    if groups:
        scopes = [(g.id, [m for m in completed if m.group_id == g.id]) for g in groups]
    else:
        scopes = [(None, completed)]

    for group_id, group_matches in scopes:
        request = StandingsRequest(
            participants=tuple(ParticipantRef(id=pid) for pid in participant_ids),
            results=tuple(_to_result(m) for m in group_matches),
            points=points,
            tiebreak=tiebreak,
            group_key=str(group_id) if group_id else None,
        )
        for row in engine.compute(request):
            session.add(
                Standing(
                    organization_id=org_id,
                    stage_id=stage_id,
                    group_id=group_id,
                    participant_id=uuid.UUID(row.participant_id),
                    played=row.played,
                    won=row.won,
                    drawn=row.drawn,
                    lost=row.lost,
                    points=Decimal(row.points),
                    score_for=row.score_for,
                    score_against=row.score_against,
                    rank=row.rank,
                    computed_at=datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None),
                )
            )
    await session.flush()

    await emit_event(
        session,
        aggregate="standings",
        event_type=events.STANDINGS_RECOMPUTED,
        payload={"stageId": str(stage_id), "organizationId": str(org_id)},
    )
    broadcaster = get_broadcaster()
    standings_data = {"stageId": str(stage_id)}
    await broadcaster.publish(org_channel(org_id), events.RT_STANDINGS_UPDATED, standings_data)
    tournament_id = await _stage_tournament_id(session, stage)
    if tournament_id is not None:
        await broadcaster.publish(
            tournament_channel(tournament_id), events.RT_STANDINGS_UPDATED, standings_data
        )


async def _stage_tournament_id(session: AsyncSession, stage: Stage) -> uuid.UUID | None:
    division = await session.get(Division, stage.division_id)
    return division.tournament_id if division is not None else None


def _to_result(match: Match) -> MatchResult:
    stats = (match.result_payload or {}).get("statistics", {})
    sides = []
    for mp in match.participants:
        other = next(o for o in match.participants if o.participant_id != mp.participant_id)
        pid = str(mp.participant_id)
        metrics = stats.get(pid, {})
        sides.append(
            SideResult(
                participant_id=pid,
                outcome=SideOutcome(mp.outcome),
                score_for=int(mp.score or 0),
                score_against=int(other.score or 0),
                metrics={
                    "points_for": int(metrics.get("points_for", 0)),
                    "points_against": int(metrics.get("points_against", 0)),
                },
            )
        )
    return MatchResult(
        match_key=str(match.id),
        sides=tuple(sides),
        group_key=str(match.group_id) if match.group_id else None,
        terminal_reason=_STATUS_REASON.get(match.status, TerminalReason.NORMAL),
    )


async def _division_participant_ids(session: AsyncSession, division_id: uuid.UUID) -> list[str]:
    rows = (
        (
            await session.execute(
                select(Participant.id).where(
                    Participant.division_id == division_id,
                    Participant.status == ParticipantStatus.APPROVED.value,
                )
            )
        )
        .scalars()
        .all()
    )
    return [str(pid) for pid in rows]


async def _points_policy(session: AsyncSession, stage: Stage) -> PointsPolicy:
    if stage.points_rule_id is not None:
        rule = await session.get(PointsRule, stage.points_rule_id)
        if rule is not None:
            return PointsPolicy(
                win=rule.win_pts, draw=rule.draw_pts, loss=rule.loss_pts, walkover=rule.walkover_pts
            )
    return PointsPolicy(win=Decimal(1))


async def _tiebreak_criteria(session: AsyncSession, stage: Stage) -> tuple[str, ...]:
    if stage.tiebreak_ruleset_id is not None:
        ruleset = await session.get(TiebreakRuleset, stage.tiebreak_ruleset_id)
        if ruleset is not None and ruleset.criteria:
            return tuple(str(c) for c in ruleset.criteria)
    # default to the sport's recommended criteria
    division = await session.get(Division, stage.division_id)
    if division is not None:
        tournament = await session.get(Tournament, division.tournament_id)
        if tournament is not None:
            profile_row = await session.get(SportProfile, tournament.sport_profile_id)
            if profile_row is not None and get_sport_registry().is_registered(profile_row.key):
                return get_sport_registry().get(profile_row.key).tiebreak_criteria()
    return ("match_wins", "point_diff")
