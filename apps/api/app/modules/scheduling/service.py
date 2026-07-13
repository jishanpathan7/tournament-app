"""Match scheduling use cases — assign/move/bulk-assign a court + time, detect
conflicts, unschedule, and build the organizer's live queue.

Orchestrates existing modules only: match reads/views come from ``scoring``, court
reads/views from ``courts``. Adds no new persistence beyond the Match columns and
``TournamentCourt`` that already exist — a proposed assignment is checked against
every other already-scheduled match in the tournament, never against a bespoke
scheduling-engine data structure (see ``app/engine/contracts.py::SchedulingEngine``
for that alternative; it's for an optimizing autoscheduler, not this organizer-driven
assign/move/detect-conflicts workflow, so it's intentionally not wired in here).
"""

from __future__ import annotations

import datetime
import logging
import uuid
from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import NotFoundError, ValidationError
from app.core.audit import record as audit_record
from app.core.events import emit_event
from app.core.factory import get_broadcaster
from app.core.perf import timed
from app.db.enums import CourtStatus, MatchStatus, NotificationChannel
from app.db.models import Match, Registration, Tournament
from app.modules.courts import repository as courts_repo
from app.modules.courts import service as courts_service
from app.modules.notifications.email_queue import queue_email
from app.modules.notifications.service import notify
from app.modules.notifications.templates import NotificationTemplate, register_template
from app.modules.scheduling import events
from app.modules.scheduling import repository as repo
from app.modules.scheduling.schemas import ConflictView, CourtQueueView, ScheduleQueueView
from app.modules.scoring import repository as scoring_repo
from app.modules.scoring import service as scoring_service
from app.realtime.channels import org_channel, tournament_channel

_logger = logging.getLogger("app.scheduling")

register_template(
    NotificationTemplate(
        type=events.NOTIFY_MATCH_SCHEDULED,
        channels=(NotificationChannel.IN_APP,),
        in_app_title="Your match is scheduled",
        in_app_body="A court and time have been set for your match.",
    )
)
register_template(
    NotificationTemplate(
        type=events.NOTIFY_MATCH_RESCHEDULED,
        channels=(NotificationChannel.IN_APP,),
        in_app_title="Your match was rescheduled",
        in_app_body="The court or time for your match has changed.",
    )
)

DEFAULT_DURATION_MINUTES = 30

# Kinds that make an assignment structurally impossible — always block the save.
# Everything else (court/participant/team overlap) is a soft warning: surfaced to
# the caller but never blocks, since organizers sometimes intentionally double-book
# briefly (a marshal moves one match manually) and the human should decide.
HARD_CONFLICT_KINDS = frozenset(
    {"court_unassigned", "court_unavailable", "unresolved_match", "outside_tournament_window"}
)

_TERMINAL_STATUSES = frozenset(
    {
        MatchStatus.COMPLETED.value,
        MatchStatus.WALKOVER.value,
        MatchStatus.NO_SHOW.value,
        MatchStatus.CANCELLED.value,
    }
)


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def _window(
    scheduled_at: datetime.datetime, duration_minutes: int
) -> tuple[datetime.datetime, datetime.datetime]:
    return scheduled_at, scheduled_at + datetime.timedelta(minutes=duration_minutes)


def _overlaps(
    a_start: datetime.datetime,
    a_end: datetime.datetime,
    b_start: datetime.datetime,
    b_end: datetime.datetime,
) -> bool:
    return a_start < b_end and b_start < a_end


async def evaluate_conflicts(
    session: AsyncSession,
    org_id: uuid.UUID,
    *,
    tournament: Tournament,
    match: Match,
    court_id: uuid.UUID,
    scheduled_at: datetime.datetime,
    duration_minutes: int,
) -> list[ConflictView]:
    """Every problem with this hypothetical (or about-to-be-saved) assignment — hard
    (structurally impossible, see ``HARD_CONFLICT_KINDS``) and soft (overlaps another
    match) alike. Read-only; never mutates."""
    conflicts: list[ConflictView] = []

    if match.status == MatchStatus.PENDING.value:
        conflicts.append(
            ConflictView(
                kind="unresolved_match",
                match_id=match.id,
                other_match_id=match.id,
                message="This match's participants aren't decided yet — the bracket "
                "hasn't advanced to it.",
            )
        )

    court = await courts_repo.get_court(session, org_id, court_id)
    if court is None:
        conflicts.append(
            ConflictView(
                kind="court_unassigned",
                match_id=match.id,
                other_match_id=match.id,
                message="Court not found.",
            )
        )
    else:
        assignment = await courts_repo.get_tournament_court(
            session, org_id, tournament.id, court_id
        )
        if assignment is None:
            conflicts.append(
                ConflictView(
                    kind="court_unassigned",
                    match_id=match.id,
                    other_match_id=match.id,
                    message=f"{court.name} is not assigned to this tournament.",
                )
            )
        elif court.status != CourtStatus.ACTIVE.value:
            conflicts.append(
                ConflictView(
                    kind="court_unavailable",
                    match_id=match.id,
                    other_match_id=match.id,
                    message=f"{court.name} is {court.status} and can't be scheduled onto.",
                )
            )

    start, end = _window(scheduled_at, duration_minutes)
    if tournament.starts_at is not None and start < tournament.starts_at:
        conflicts.append(
            ConflictView(
                kind="outside_tournament_window",
                match_id=match.id,
                other_match_id=match.id,
                message="Scheduled before the tournament starts.",
            )
        )
    if tournament.ends_at is not None and end > tournament.ends_at:
        conflicts.append(
            ConflictView(
                kind="outside_tournament_window",
                match_id=match.id,
                other_match_id=match.id,
                message="Scheduled after the tournament ends.",
            )
        )

    participant_ids = {mp.participant_id for mp in match.participants}
    others = await repo.list_scheduled_matches(
        session, org_id, tournament.id, exclude_match_id=match.id
    )
    all_ids = set(participant_ids)
    for other in others:
        all_ids |= {mp.participant_id for mp in other.participants}
    kinds = await repo.participant_kinds(session, org_id, all_ids)

    for other in others:
        # `list_scheduled_matches` filters to `scheduled_at IS NOT NULL` at the DB level.
        assert other.scheduled_at is not None
        other_start, other_end = _window(
            other.scheduled_at, other.duration_minutes or DEFAULT_DURATION_MINUTES
        )
        if not _overlaps(start, end, other_start, other_end):
            continue
        if other.court_id == court_id:
            conflicts.append(
                ConflictView(
                    kind="court_overlap",
                    match_id=match.id,
                    other_match_id=other.id,
                    message="Overlaps with another match already scheduled on this court.",
                )
            )
        shared = participant_ids & {mp.participant_id for mp in other.participants}
        for pid in shared:
            kind = "team_overlap" if kinds.get(pid) in ("pair", "team") else "participant_overlap"
            conflicts.append(
                ConflictView(
                    kind=kind,
                    match_id=match.id,
                    other_match_id=other.id,
                    participant_id=pid,
                    message="A participant in this match is already scheduled for an "
                    "overlapping match.",
                )
            )
    return conflicts


async def _require_match(session: AsyncSession, org_id: uuid.UUID, match_id: uuid.UUID) -> Match:
    match = await scoring_repo.get_match(session, org_id, match_id)
    if match is None:
        raise NotFoundError("Match not found")
    return match


async def _require_tournament(
    session: AsyncSession, org_id: uuid.UUID, tournament_id: uuid.UUID
) -> Tournament:
    tournament = await courts_repo.get_tournament(session, org_id, tournament_id)
    if tournament is None:
        raise NotFoundError("Tournament not found")
    return tournament


async def check(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    match_id: uuid.UUID,
    court_id: uuid.UUID,
    scheduled_at: datetime.datetime,
    duration_minutes: int,
) -> list[ConflictView]:
    """Dry run — every conflict (hard + soft), never mutates or raises on conflicts."""
    match = await _require_match(session, org_id, match_id)
    tournament = await _require_tournament(session, org_id, match.tournament_id)
    return await evaluate_conflicts(
        session,
        org_id,
        tournament=tournament,
        match=match,
        court_id=court_id,
        scheduled_at=scheduled_at,
        duration_minutes=duration_minutes,
    )


async def _do_assign(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    match: Match,
    tournament: Tournament,
    court_id: uuid.UUID,
    scheduled_at: datetime.datetime,
    duration_minutes: int,
) -> list[ConflictView]:
    conflicts = await evaluate_conflicts(
        session,
        org_id,
        tournament=tournament,
        match=match,
        court_id=court_id,
        scheduled_at=scheduled_at,
        duration_minutes=duration_minutes,
    )
    hard = [c for c in conflicts if c.kind in HARD_CONFLICT_KINDS]
    if hard:
        raise ValidationError(hard[0].message, code="schedule_conflict")

    was_scheduled = match.court_id is not None and match.scheduled_at is not None
    match.court_id = court_id
    match.scheduled_at = scheduled_at
    match.duration_minutes = duration_minutes
    await session.flush()
    # `updated_at` has a DB-side trigger + ORM `onupdate` — expired after flush, and
    # (unlike `scoring.score_match`) nothing downstream here re-selects this row to
    # incidentally repopulate it, so `build_match_view` would otherwise trigger an
    # implicit lazy load outside an async-safe context.
    await session.refresh(match, attribute_names=["updated_at"])

    action = events.MATCH_RESCHEDULED if was_scheduled else events.MATCH_SCHEDULED
    audit_record(
        session,
        organization_id=org_id,
        actor_id=actor_id,
        action=action,
        entity="match",
        entity_id=match.id,
        after={"courtId": str(court_id), "scheduledAt": scheduled_at.isoformat()},
    )
    await emit_event(
        session,
        aggregate="match",
        event_type=action,
        payload={"id": str(match.id), "organizationId": str(org_id)},
    )
    await _broadcast(org_id, match)
    await _notify(session, org_id, match, rescheduled=was_scheduled)

    return [c for c in conflicts if c.kind not in HARD_CONFLICT_KINDS]


async def assign(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    match_id: uuid.UUID,
    court_id: uuid.UUID,
    scheduled_at: datetime.datetime,
    duration_minutes: int,
) -> tuple[Match, list[ConflictView]]:
    match = await _require_match(session, org_id, match_id)
    tournament = await _require_tournament(session, org_id, match.tournament_id)
    soft = await _do_assign(
        session,
        org_id=org_id,
        actor_id=actor_id,
        match=match,
        tournament=tournament,
        court_id=court_id,
        scheduled_at=scheduled_at,
        duration_minutes=duration_minutes,
    )
    return match, soft


async def bulk_assign(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    tournament_id: uuid.UUID,
    items: Sequence[tuple[uuid.UUID, uuid.UUID, datetime.datetime, int]],
) -> list[tuple[Match, list[ConflictView]]]:
    """All-or-nothing: one item hitting a hard conflict raises, rolling back the whole
    batch via the caller's request-scoped transaction. Items are applied in order, so
    a later item's conflict check sees every earlier item's assignment in this batch."""
    item_count = len(items)
    async with timed("bulk_assign.fetch_tournament", _logger, extra={"item_count": item_count}):
        tournament = await _require_tournament(session, org_id, tournament_id)
    results: list[tuple[Match, list[ConflictView]]] = []
    for i, (match_id, court_id, scheduled_at, duration_minutes) in enumerate(items):
        async with timed("bulk_assign.fetch_match", _logger, extra={"item_index": i}):
            match = await _require_match(session, org_id, match_id)  # PERF: N SELECT per item
        if match.tournament_id != tournament_id:
            raise NotFoundError(f"Match not found in this tournament: {match_id}")
        async with timed(
            "bulk_assign.do_assign",  # PERF: re-fetches all scheduled matches each iteration
            _logger,
            extra={"item_index": i},
        ):
            soft = await _do_assign(
                session,
                org_id=org_id,
                actor_id=actor_id,
                match=match,
                tournament=tournament,
                court_id=court_id,
                scheduled_at=scheduled_at,
                duration_minutes=duration_minutes,
            )
        results.append((match, soft))
    return results


async def unschedule(
    session: AsyncSession, *, org_id: uuid.UUID, actor_id: uuid.UUID, match_id: uuid.UUID
) -> Match:
    match = await _require_match(session, org_id, match_id)
    match.court_id = None
    match.scheduled_at = None
    match.duration_minutes = None
    await session.flush()
    await session.refresh(match, attribute_names=["updated_at"])

    audit_record(
        session,
        organization_id=org_id,
        actor_id=actor_id,
        action=events.MATCH_UNSCHEDULED,
        entity="match",
        entity_id=match.id,
        after={"courtId": None, "scheduledAt": None},
    )
    await emit_event(
        session,
        aggregate="match",
        event_type=events.MATCH_UNSCHEDULED,
        payload={"id": str(match.id), "organizationId": str(org_id)},
    )
    await _broadcast(org_id, match)
    return match


async def _broadcast(org_id: uuid.UUID, match: Match) -> None:
    broadcaster = get_broadcaster()
    match_data = {
        "tournamentId": str(match.tournament_id),
        "matchId": str(match.id),
        "courtId": str(match.court_id) if match.court_id else None,
        "scheduledAt": match.scheduled_at.isoformat() if match.scheduled_at else None,
    }
    for channel in (org_channel(org_id), tournament_channel(match.tournament_id)):
        await broadcaster.publish(channel, events.RT_MATCH_SCHEDULED, match_data)


async def _participant_email(
    session: AsyncSession, org_id: uuid.UUID, participant_id: uuid.UUID
) -> str | None:
    """Look up participant's email via their approved registration form_response."""
    from sqlalchemy import select

    stmt = (
        select(Registration)
        .where(
            Registration.participant_id == participant_id,
            Registration.organization_id == org_id,
        )
        .limit(1)
    )
    reg = (await session.execute(stmt)).scalars().first()
    if reg is None:
        return None
    email = (reg.form_response or {}).get("email")
    return str(email).strip() if email else None


async def _notify(
    session: AsyncSession, org_id: uuid.UUID, match: Match, *, rescheduled: bool
) -> None:
    email_template = "match_rescheduled" if rescheduled else "match_scheduled"
    for mp in match.participants:
        # match.scheduled removed from IN_APP — portal schedule view already shows it.
        # Rescheduled keeps IN_APP (changed plan = organizer must tell participant).
        if rescheduled:
            user_id = await scoring_service.participant_user(session, org_id, mp.participant_id)
            if user_id is not None:
                await notify(
                    session,
                    organization_id=org_id,
                    recipient_user_id=user_id,
                    type=events.NOTIFY_MATCH_RESCHEDULED,
                    data={"matchId": str(match.id), "tournamentId": str(match.tournament_id)},
                )
        email = await _participant_email(session, org_id, mp.participant_id)
        if email:
            await queue_email(
                session,
                to=email,
                template=email_template,
                data={"matchId": str(match.id)},
                organization_id=org_id,
            )


async def auto_schedule_next(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID | None,
    tournament: Tournament,
    freed_court_id: uuid.UUID,
) -> Match | None:
    """Called post-match-completion when tournament.settings['auto_schedule'] is true.

    Finds the next schedulable unscheduled match and assigns it to the freed court
    starting now. Returns the newly scheduled match or None if the queue is empty.
    Soft conflicts (overlap warnings) are logged and silently ignored — auto-scheduling
    never blocks on warnings.
    """
    matches = await repo.list_tournament_matches_with_participants(session, org_id, tournament.id)
    _TERMINAL = frozenset(
        {
            MatchStatus.COMPLETED.value,
            MatchStatus.WALKOVER.value,
            MatchStatus.NO_SHOW.value,
            MatchStatus.CANCELLED.value,
        }
    )
    candidates = sorted(
        [
            m
            for m in matches
            if m.status not in _TERMINAL
            and m.status != MatchStatus.PENDING.value
            and (m.court_id is None or m.scheduled_at is None)
        ],
        key=lambda m: (m.round.seq if m.round else 0, m.created_at),
    )
    if not candidates:
        return None

    next_match = candidates[0]
    scheduled_at = _now()
    duration = next_match.duration_minutes or DEFAULT_DURATION_MINUTES
    _system_actor = actor_id or tournament.organization_id

    try:
        await _do_assign(
            session,
            org_id=org_id,
            actor_id=_system_actor,
            match=next_match,
            tournament=tournament,
            court_id=freed_court_id,
            scheduled_at=scheduled_at,
            duration_minutes=duration,
        )
    except ValidationError:
        return None

    return next_match


async def build_queue(
    session: AsyncSession, org_id: uuid.UUID, tournament_id: uuid.UUID
) -> ScheduleQueueView:
    await _require_tournament(session, org_id, tournament_id)
    assignments = await courts_repo.list_tournament_courts(session, org_id, tournament_id)
    matches = await repo.list_tournament_matches_with_participants(session, org_id, tournament_id)

    now = _now()
    by_court: dict[uuid.UUID, list[Match]] = {}
    unscheduled: list[Match] = []
    pending: list[Match] = []
    for m in matches:
        if m.status == MatchStatus.PENDING.value:
            pending.append(m)
        elif m.court_id is None or m.scheduled_at is None:
            unscheduled.append(m)
        else:
            by_court.setdefault(m.court_id, []).append(m)

    courts_view: list[CourtQueueView] = []
    for a in assignments:
        # `by_court` only ever holds matches with both court_id and scheduled_at set
        # (see the branch above); `scheduled_at` is guaranteed non-null here.
        court_matches = sorted(
            by_court.get(a.court_id, []),
            key=lambda m: m.scheduled_at
            or datetime.datetime.min.replace(tzinfo=datetime.timezone.utc),
        )
        upcoming = [m for m in court_matches if m.status not in _TERMINAL_STATUSES]
        current = upcoming[0] if upcoming else None
        next_match = upcoming[1] if len(upcoming) > 1 else None
        is_delayed = False
        if current is not None and current.scheduled_at is not None:
            _, end = _window(
                current.scheduled_at, current.duration_minutes or DEFAULT_DURATION_MINUTES
            )
            is_delayed = end < now
        courts_view.append(
            CourtQueueView(
                court=courts_service.build_court_view(a.court),
                current_match=scoring_service.build_match_view(current) if current else None,
                next_match=scoring_service.build_match_view(next_match) if next_match else None,
                is_delayed=is_delayed,
            )
        )

    unscheduled.sort(key=lambda m: (m.round.seq if m.round else 0, m.created_at))
    return ScheduleQueueView(
        courts=courts_view,
        unscheduled=[scoring_service.build_match_view(m) for m in unscheduled],
        pending=[scoring_service.build_match_view(m) for m in pending],
    )
