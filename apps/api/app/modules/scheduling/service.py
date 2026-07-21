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
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import NotFoundError, ValidationError
from app.core.audit import record as audit_record
from app.core.events import emit_event
from app.core.factory import get_broadcaster
from app.core.perf import timed
from app.db.enums import CourtStatus, MatchStatus, NotificationChannel
from app.db.models import Court, Match, Registration, Tournament, TournamentCourt
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


def _window_end(ends_at: datetime.datetime) -> datetime.datetime:
    """The instant the tournament window closes.

    A date-only end arrives as midnight, meaning "this day" rather than "the very
    first moment of it", so it is stretched to cover the whole day. A genuine time
    is respected as given.

    Without this a single-day tournament was unschedulable: start and end both
    landed on midnight, so every match on the day finished after the tournament
    had supposedly ended, and bulk schedule rejected the entire event.
    """
    is_date_only = (
        ends_at.hour == 0
        and ends_at.minute == 0
        and ends_at.second == 0
        and ends_at.microsecond == 0
    )
    if not is_date_only:
        return ends_at
    return ends_at.replace(hour=23, minute=59, second=59, microsecond=999999)


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
    # --- optional bulk-path caches: when provided, DB calls are skipped ---
    _court_cache: dict[uuid.UUID, Court] | None = None,
    _tournament_court_cache: dict[uuid.UUID, TournamentCourt | None] | None = None,
    _scheduled_cache: list[Match] | None = None,
    _kinds_cache: dict[uuid.UUID, str] | None = None,
) -> list[ConflictView]:
    """Every problem with this hypothetical (or about-to-be-saved) assignment — hard
    (structurally impossible, see ``HARD_CONFLICT_KINDS``) and soft (overlaps another
    match) alike. Read-only; never mutates.

    The *_cache params are only passed by bulk_assign to avoid N DB round-trips;
    the single-assign path leaves them None, preserving identical behavior.
    """
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

    if _court_cache is not None:
        court: Court | None = _court_cache.get(court_id)
    else:
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
        if _tournament_court_cache is not None:
            assignment: TournamentCourt | None = _tournament_court_cache.get(court_id)
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
    window_end = _window_end(tournament.ends_at) if tournament.ends_at else None
    if tournament.starts_at is not None and start < tournament.starts_at:
        conflicts.append(
            ConflictView(
                kind="outside_tournament_window",
                match_id=match.id,
                other_match_id=match.id,
                message="Scheduled before the tournament starts.",
            )
        )
    if window_end is not None and end > window_end:
        conflicts.append(
            ConflictView(
                kind="outside_tournament_window",
                match_id=match.id,
                other_match_id=match.id,
                message="Scheduled after the tournament ends.",
            )
        )

    participant_ids = {mp.participant_id for mp in match.participants}

    if _scheduled_cache is not None:
        # Filter in Python — the cache is maintained by bulk_assign after each assignment.
        others: Sequence[Match] = [m for m in _scheduled_cache if m.id != match.id]
    else:
        others = await repo.list_scheduled_matches(
            session, org_id, tournament.id, exclude_match_id=match.id
        )

    if _kinds_cache is not None:
        kinds: dict[uuid.UUID, str] = _kinds_cache
    else:
        all_ids = set(participant_ids)
        for other in others:
            all_ids |= {mp.participant_id for mp in other.participants}
        kinds = await repo.participant_kinds(session, org_id, all_ids)

    for other in others:
        # `list_scheduled_matches` filters to `scheduled_at IS NOT NULL` at the DB level.
        # For the cached path, only scheduled matches are in the cache (maintained by bulk_assign).
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
    _court_cache: dict[uuid.UUID, Court] | None = None,
    _tournament_court_cache: dict[uuid.UUID, TournamentCourt | None] | None = None,
    _scheduled_cache: list[Match] | None = None,
    _kinds_cache: dict[uuid.UUID, str] | None = None,
    _email_cache: dict[uuid.UUID, str | None] | None = None,
    _skip_broadcast: bool = False,
) -> list[ConflictView]:
    conflicts = await evaluate_conflicts(
        session,
        org_id,
        tournament=tournament,
        match=match,
        court_id=court_id,
        scheduled_at=scheduled_at,
        duration_minutes=duration_minutes,
        _court_cache=_court_cache,
        _tournament_court_cache=_tournament_court_cache,
        _scheduled_cache=_scheduled_cache,
        _kinds_cache=_kinds_cache,
    )
    hard = [c for c in conflicts if c.kind in HARD_CONFLICT_KINDS]
    if hard:
        raise ValidationError(hard[0].message, code="schedule_conflict")

    was_scheduled = match.court_id is not None and match.scheduled_at is not None
    match.court_id = court_id
    match.scheduled_at = scheduled_at
    match.duration_minutes = duration_minutes
    await session.flush()
    # `updated_at` has a DB-side trigger + ORM `onupdate` — expired after flush. In the
    # bulk path, `participants` is also expired (selectinload doesn't survive a flush),
    # and `evaluate_conflicts` accesses `other.participants` synchronously in the for
    # loop on the next iteration — triggering a lazy load from the main greenlet raises
    # MissingGreenlet. Refresh all relationships that build_match_view accesses synchronously
    # (participants, round, group). Single-assign only needs `updated_at`.
    if _scheduled_cache is not None:
        await session.refresh(
            match, attribute_names=["updated_at", "participants", "round", "group"]
        )
    else:
        await session.refresh(match, attribute_names=["updated_at"])

    # Maintain the in-memory scheduled cache for subsequent iterations in bulk_assign.
    # This ensures later items in the same batch see earlier assignments as conflicts.
    if _scheduled_cache is not None:
        _scheduled_cache.append(match)

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
    if not _skip_broadcast:
        await _broadcast(org_id, match)
    await _notify(session, org_id, match, rescheduled=was_scheduled, _email_cache=_email_cache)

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
    a later item's conflict check sees every earlier item's assignment in this batch.

    Why faster than the single-assign loop:
    - All matches loaded in ONE batch query (not N individual SELECT per item).
    - All courts + TournamentCourt assignments loaded in ONE batch query each.
    - list_scheduled_matches called ONCE before the loop; in-memory list updated
      after each flush (via _scheduled_cache mutated inside _do_assign).
    - participant_kinds loaded ONCE for all participant_ids in the batch.
    Result: O(N) DB round-trips → O(1) pre-load queries + N flushes.
    """
    item_count = len(items)
    async with timed("bulk_assign.fetch_tournament", _logger, extra={"item_count": item_count}):
        tournament = await _require_tournament(session, org_id, tournament_id)

    match_ids = [mid for mid, _cid, _sat, _dur in items]
    court_ids = list({cid for _mid, cid, _sat, _dur in items})

    async with timed("bulk_assign.preload", _logger, extra={"item_count": item_count}):
        matches_dict = await repo.get_matches_by_ids(session, org_id, match_ids)
        court_cache = await repo.get_courts_by_ids(session, org_id, court_ids)
        tc_cache: dict[uuid.UUID, Any] = await repo.get_tournament_courts_by_court_ids(
            session, org_id, tournament_id, court_ids
        )
        # Scheduled matches snapshot: used to check conflicts for all items.
        # _do_assign appends each newly-assigned match to this list so later
        # iterations see earlier assignments in the same batch.
        scheduled_cache: list[Match] = list(
            await repo.list_scheduled_matches(session, org_id, tournament_id)
        )
        # Participant kinds for all participants involved — both batch matches and
        # already-scheduled matches (needed for team_overlap vs participant_overlap).
        all_participant_ids: set[uuid.UUID] = set()
        for m in matches_dict.values():
            for mp in m.participants:
                all_participant_ids.add(mp.participant_id)
        for m in scheduled_cache:
            for mp in m.participants:
                all_participant_ids.add(mp.participant_id)
        kinds_cache = await repo.participant_kinds(session, org_id, all_participant_ids)
        # Batch-load participant emails: replaces N per-participant registration queries
        # inside _notify with a single IN(...) query for all batch participant IDs.
        email_cache = await repo.get_participant_emails_by_ids(
            session, org_id, list(all_participant_ids)
        )

    results: list[tuple[Match, list[ConflictView]]] = []
    async with timed("bulk_assign.loop", _logger, extra={"item_count": item_count}):
        for i, (match_id, court_id, scheduled_at, duration_minutes) in enumerate(items):
            match = matches_dict.get(match_id)
            if match is None:
                raise NotFoundError(f"Match not found: {match_id}")
            if match.tournament_id != tournament_id:
                raise NotFoundError(f"Match not found in this tournament: {match_id}")
            soft = await _do_assign(
                session,
                org_id=org_id,
                actor_id=actor_id,
                match=match,
                tournament=tournament,
                court_id=court_id,
                scheduled_at=scheduled_at,
                duration_minutes=duration_minutes,
                _court_cache=court_cache,
                _tournament_court_cache=tc_cache,
                _scheduled_cache=scheduled_cache,
                _kinds_cache=kinds_cache,
                _email_cache=email_cache,
                _skip_broadcast=True,
            )
            results.append((match, soft))

    # Emit one SSE event for the whole batch instead of N per-match broadcasts.
    # Per-match broadcasts would trigger N frontend query invalidations for the
    # same matches list, causing N redundant GET refetches.
    broadcaster = get_broadcaster()
    batch_payload = {"tournamentId": str(tournament_id)}
    for channel in (org_channel(org_id), tournament_channel(tournament_id)):
        await broadcaster.publish(channel, events.RT_MATCH_SCHEDULED, batch_payload)

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
    session: AsyncSession,
    org_id: uuid.UUID,
    match: Match,
    *,
    rescheduled: bool,
    _email_cache: dict[uuid.UUID, str | None] | None = None,
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
        if _email_cache is not None:
            email = _email_cache.get(mp.participant_id)
        else:
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
    next_match = await repo.get_next_schedulable_match(session, org_id, tournament.id)
    if next_match is None:
        return None
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


def _participants_by_id(match: Match | None) -> "dict[uuid.UUID, Any]":
    if match is None:
        return {}
    return {
        mp.participant_id: mp.participant for mp in match.participants if mp.participant is not None
    }


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
                current_match=(
                    scoring_service.build_match_view(
                        current, participants_by_id=_participants_by_id(current)
                    )
                    if current
                    else None
                ),
                next_match=(
                    scoring_service.build_match_view(
                        next_match, participants_by_id=_participants_by_id(next_match)
                    )
                    if next_match
                    else None
                ),
                is_delayed=is_delayed,
            )
        )

    unscheduled.sort(key=lambda m: (m.round.seq if m.round else 0, m.created_at))
    return ScheduleQueueView(
        courts=courts_view,
        unscheduled=[
            scoring_service.build_match_view(m, participants_by_id=_participants_by_id(m))
            for m in unscheduled
        ],
        pending=[
            scoring_service.build_match_view(m, participants_by_id=_participants_by_id(m))
            for m in pending
        ],
    )
