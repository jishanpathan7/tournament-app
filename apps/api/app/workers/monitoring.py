"""Monitoring worker — detects operational issues in live tournaments and emits
Action Required notifications to organizers. Runs as a ``monitoring.check``
outbox job every 5 minutes while any tournament is live.
"""

from __future__ import annotations

import datetime
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import CourtStatus, MatchStatus, TournamentStatus
from app.db.models import Court, Match, Tournament
from app.modules.notifications import service as notif_service
from app.modules.orgs import repository as orgs_repo
from app.workers.registry import JobContext, handler

MONITORING_CHECK = "monitoring.check"

_COURT_IDLE_MINUTES = 10
_MATCH_STALLED_MINUTES = 20

logger = logging.getLogger("app.workers.monitoring")

_ORGANIZER_ROLES = {"owner", "admin", "organizer"}


async def _organizer_ids(session: AsyncSession, org_id: uuid.UUID) -> list[uuid.UUID]:
    members = await orgs_repo.list_members(session, org_id)
    return [m.user_id for m in members if m.org_role in _ORGANIZER_ROLES]


@handler(MONITORING_CHECK)
async def run_monitoring_check(payload: dict, ctx: JobContext) -> None:
    """Check all live tournaments in an org for operational issues."""
    org_id_str = payload.get("organizationId")
    if not org_id_str:
        return
    org_id = uuid.UUID(org_id_str)
    now = datetime.datetime.now(datetime.timezone.utc)

    # All live tournaments in this org
    stmt = select(Tournament).where(
        Tournament.organization_id == org_id,
        Tournament.status == TournamentStatus.LIVE.value,
    )
    tournaments = (await ctx.session.execute(stmt)).scalars().all()

    if not tournaments:
        return

    organizer_ids = await _organizer_ids(ctx.session, org_id)
    if not organizer_ids:
        return

    for tournament in tournaments:
        await _check_tournament(ctx.session, org_id, tournament, organizer_ids, now)


async def _check_tournament(
    session: AsyncSession,
    org_id: uuid.UUID,
    tournament: Tournament,
    organizer_ids: list[uuid.UUID],
    now: datetime.datetime,
) -> None:
    # Fetch all active courts for this tournament
    court_stmt = (
        select(Court)
        .join(
            Match,
            (Match.court_id == Court.id)
            & (Match.tournament_id == tournament.id)
            & (Match.organization_id == org_id),
            isouter=True,
        )
        .where(
            Court.organization_id == org_id,
            Court.status == CourtStatus.ACTIVE.value,
        )
        .distinct()
    )

    # Fetch live matches for this tournament
    live_stmt = select(Match).where(
        Match.organization_id == org_id,
        Match.tournament_id == tournament.id,
        Match.status == MatchStatus.LIVE.value,
    )
    live_matches = (await session.execute(live_stmt)).scalars().all()
    live_court_ids = {m.court_id for m in live_matches if m.court_id}

    courts = (await session.execute(court_stmt)).scalars().all()

    for court in courts:
        if court.id in live_court_ids:
            # Court is busy — check if live match is stalled (no score update)
            stalled = [
                m
                for m in live_matches
                if m.court_id == court.id
                and m.updated_at is not None
                and (now - m.updated_at).total_seconds() >= _MATCH_STALLED_MINUTES * 60
            ]
            for match in stalled:
                dedup = f"match_stalled:{match.id}"
                for uid in organizer_ids:
                    await notif_service.notify(
                        session,
                        organization_id=org_id,
                        recipient_user_id=uid,
                        type="ops.match_stalled",
                        data={
                            "tournament_id": str(tournament.id),
                            "court_name": court.name,
                            "stalled_minutes": _MATCH_STALLED_MINUTES,
                            "match_id": str(match.id),
                        },
                        dedup_key=dedup,
                    )
        else:
            # Court is idle — check how long since last match ended
            last_completed_stmt = (
                select(Match)
                .where(
                    Match.organization_id == org_id,
                    Match.tournament_id == tournament.id,
                    Match.court_id == court.id,
                    Match.status.in_([MatchStatus.COMPLETED.value, MatchStatus.WALKOVER.value]),
                )
                .order_by(Match.updated_at.desc())
                .limit(1)
            )
            last = (await session.execute(last_completed_stmt)).scalar_one_or_none()
            if last is not None and last.updated_at is not None:
                idle_seconds = (now - last.updated_at).total_seconds()
                if idle_seconds >= _COURT_IDLE_MINUTES * 60:
                    idle_minutes = int(idle_seconds // 60)
                    dedup = f"court_idle:{court.id}"
                    for uid in organizer_ids:
                        await notif_service.notify(
                            session,
                            organization_id=org_id,
                            recipient_user_id=uid,
                            type="ops.court_idle",
                            data={
                                "tournament_id": str(tournament.id),
                                "court_name": court.name,
                                "idle_minutes": idle_minutes,
                            },
                            dedup_key=dedup,
                        )

    logger.info(
        "monitoring.check.done",
        extra={"tournament_id": str(tournament.id), "courts_checked": len(courts)},
    )
