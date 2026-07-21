"""Tournament domain use cases — orchestrates the engine + sport registry + persistence.

Thin: it validates against the engine/sport contracts, calls the engine for all
competition logic, and translates the engine's abstract ``StructurePlan`` into DB rows.
It never reimplements fixture/format logic. Services never commit (the request session
owns the transaction + RLS org context); every query is also org-scoped in the repo.
"""

from __future__ import annotations

import datetime
import random
import uuid
from typing import Any

from sqlalchemy import delete as sa_delete
from sqlalchemy import select
from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ConflictError, NotFoundError, ValidationError
from app.cache import keys as cache_keys
from app.core import audit
from app.core.events import emit_event
from app.core.factory import (
    get_advancement_engine,
    get_cache,
    get_format_registry,
    get_sport_registry,
)
from app.db.enums import (
    AttendanceStatus,
    MatchOutcome,
    MatchStatus,
    OrgRole,
    ParticipantKind,
    TournamentStatus,
    Visibility,
)
from app.db.models import (
    Division,
    Group,
    Match,
    MatchParticipant,
    Participant,
    Round,
    SportProfile,
    Stage,
    Tournament,
    TournamentCourt,
)
from app.db.types import uuid7 as _uuid7
from app.engine import (
    AdvancementRequest,
    ByeRef,
    EngineValidationError,
    FormatKey,
    GenerateRequest,
    LoserOfRef,
    MatchPlan,
    ParticipantRef,
    ParticipantSideRef,
    SeedRef,
    SourceRefs,
    StructurePlan,
    WinnerOfRef,
    parse_source_refs,
)
from app.modules.notifications import service as notif_service
from app.modules.orgs import repository as orgs_repo
from app.modules.registrations import notifications as reg_notifications
from app.modules.registrations import repository as registrations_repo
from app.modules.scoring import repository as scoring_repo
from app.modules.tournaments import events
from app.modules.tournaments import repository as repo
from app.sports.config import merge_sport_config

_ORGANIZER_ROLES = {OrgRole.OWNER.value, OrgRole.ADMIN.value, OrgRole.ORGANIZER.value}


async def _notify_organizers(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    type: str,
    data: dict,
) -> None:
    """Fan out an IN_APP notification to all owners/admins/organizers in the org."""
    members = await orgs_repo.list_members(session, org_id)
    for m in members:
        if m.org_role in _ORGANIZER_ROLES:
            await notif_service.notify(
                session,
                organization_id=org_id,
                recipient_user_id=m.user_id,
                type=type,
                data=data,
            )


_TERMINAL_STATUSES = {
    MatchStatus.COMPLETED.value,
    MatchStatus.WALKOVER.value,
    MatchStatus.NO_SHOW.value,
}

_TRANSITIONS: dict[TournamentStatus, set[TournamentStatus]] = {
    TournamentStatus.DRAFT: {TournamentStatus.REGISTRATION},
    TournamentStatus.REGISTRATION: {TournamentStatus.SEEDING, TournamentStatus.DRAFT},
    TournamentStatus.SEEDING: {TournamentStatus.LIVE, TournamentStatus.REGISTRATION},
    TournamentStatus.LIVE: {TournamentStatus.COMPLETED},
    TournamentStatus.COMPLETED: {TournamentStatus.ARCHIVED},
}
_PUBLISH_FIELDS = {
    "draw": "draw_published_at",
    "schedule": "schedule_published_at",
    "results": "results_published_at",
}


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


# ---- tournament ----


async def create_tournament(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    name: str,
    slug: str,
    sport_key: str,
    visibility: Visibility,
) -> Tournament:
    if not get_sport_registry().is_registered(sport_key):
        raise ValidationError(f"Unsupported sport {sport_key!r}", code="unsupported_sport")
    if await repo.get_tournament_by_slug(session, org_id, slug) is not None:
        raise ConflictError("That tournament slug is taken")
    profile = await _ensure_sport_profile(session, org_id, sport_key)
    tournament = Tournament(
        organization_id=org_id,
        sport_profile_id=profile.id,
        slug=slug,
        name=name,
        status=TournamentStatus.DRAFT.value,
        visibility=visibility.value,
    )
    session.add(tournament)
    await session.flush()
    await _audit_event(
        session,
        org_id,
        actor_id,
        events.TOURNAMENT_CREATED,
        tournament.id,
        after={"slug": slug, "sportKey": sport_key},
    )
    return tournament


async def update_tournament(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    tournament_id: uuid.UUID,
    name: str | None,
    visibility: Visibility | None,
    starts_at: datetime.datetime | None,
    ends_at: datetime.datetime | None,
    settings: dict[str, Any] | None,
    auto_schedule: bool | None = None,
    pair_creation_mode: str | None = None,
    match_duration_minutes: int | None = None,
    venue_id: uuid.UUID | None = None,
    clear_venue: bool | None = None,
) -> Tournament:
    tournament = await _require_tournament(session, org_id, tournament_id)
    if name is not None:
        tournament.name = name
    if visibility is not None:
        tournament.visibility = visibility.value
    if starts_at is not None:
        tournament.starts_at = starts_at
    if ends_at is not None:
        tournament.ends_at = ends_at
    if auto_schedule is not None:
        tournament.settings = {**(tournament.settings or {}), "auto_schedule": auto_schedule}
    if pair_creation_mode is not None:
        tournament.settings = {
            **(tournament.settings or {}),
            "pair_creation_mode": pair_creation_mode,
        }
    if match_duration_minutes is not None:
        tournament.settings = {
            **(tournament.settings or {}),
            "match_duration_minutes": match_duration_minutes,
        }
    if settings is not None:
        profile = get_sport_registry().get(await _sport_key(session, tournament))
        merged = merge_sport_config(profile, tournament_settings=settings)
        try:
            profile.validate_config(merged)
        except EngineValidationError as exc:
            raise ValidationError(str(exc), code="invalid_sport_config") from exc
        tournament.settings = settings
    if clear_venue:
        tournament.venue_id = None
    elif venue_id is not None:
        tournament.venue_id = venue_id
    if tournament.starts_at and tournament.ends_at and tournament.starts_at > tournament.ends_at:
        raise ValidationError("starts_at must be on or before ends_at")
    await session.flush()
    await session.refresh(tournament, attribute_names=["venue"])
    await _audit_event(session, org_id, actor_id, events.TOURNAMENT_UPDATED, tournament.id)
    await get_cache().delete(cache_keys.public_tournament_keys(tournament.id)["overview"])
    return tournament


async def delete_tournament(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    tournament_id: uuid.UUID,
) -> None:
    """Soft-delete — hides the tournament from console and public surfaces."""
    tournament = await _require_tournament(session, org_id, tournament_id)
    # Release court assignments and match court refs so courts aren't stuck after soft-delete.
    await session.execute(
        sa_delete(TournamentCourt).where(TournamentCourt.tournament_id == tournament_id)
    )
    await session.execute(
        sa_update(Match)
        .where(Match.tournament_id == tournament_id, Match.court_id.isnot(None))
        .values(court_id=None)
    )
    tournament.deleted_at = _now()
    await session.flush()
    await _audit_event(
        session,
        org_id,
        actor_id,
        events.TOURNAMENT_DELETED,
        tournament.id,
        before={"name": tournament.name, "slug": tournament.slug, "status": tournament.status},
    )


async def purge_tournament(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    tournament_id: uuid.UUID,
    confirm_name: str,
) -> None:
    """Hard-delete a soft-deleted tournament and everything under it. Irreversible.

    Two gates before anything is removed: the tournament must already be soft-deleted,
    and the caller must echo its name back. The audit row is written first so the
    record of the purge outlives the data it describes.
    """
    tournament = await repo.get_deleted_tournament(session, org_id, tournament_id)
    if tournament is None:
        raise NotFoundError("No deleted tournament with that id")
    if confirm_name.strip() != tournament.name:
        raise ValidationError(
            "Type the tournament's name exactly to confirm the purge",
            code="purge_name_mismatch",
        )

    await _audit_event(
        session,
        org_id,
        actor_id,
        events.TOURNAMENT_PURGED,
        tournament.id,
        before={"name": tournament.name, "slug": tournament.slug, "status": tournament.status},
    )

    # participants → squads is RESTRICT (a squad may not vanish while a participant
    # still claims it), so the cascade from tournaments cannot resolve that edge on
    # its own. Clearing the participants first lets the rest cascade normally.
    await session.execute(
        sa_delete(Participant).where(
            Participant.division_id.in_(
                select(Division.id).where(Division.tournament_id == tournament_id)
            )
        )
    )
    await session.execute(sa_delete(Tournament).where(Tournament.id == tournament_id))
    await session.flush()
    await get_cache().delete_many(list(cache_keys.public_tournament_keys(tournament_id).values()))


async def transition_status(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    tournament_id: uuid.UUID,
    new_status: TournamentStatus,
) -> Tournament:
    tournament = await _require_tournament(session, org_id, tournament_id)
    current = TournamentStatus(tournament.status)
    if new_status not in _TRANSITIONS.get(current, set()):
        raise ValidationError(
            f"cannot transition from {current.value} to {new_status.value}",
            code="invalid_transition",
        )
    tournament.status = new_status.value
    await session.flush()
    await _audit_event(
        session,
        org_id,
        actor_id,
        events.TOURNAMENT_STATUS_CHANGED,
        tournament.id,
        before={"status": current.value},
        after={"status": new_status.value},
    )
    if new_status is TournamentStatus.LIVE:
        registrations = await registrations_repo.list_registrations_for_tournament(
            session, org_id, tournament.id
        )
        approved_emails = {
            str(r.form_response.get("email", "")).strip()
            for r in registrations
            if r.status == "approved" and r.form_response.get("email")
        }
        approved_emails.discard("")
        if approved_emails:
            await reg_notifications.notify_draw_published(
                session,
                org_id=org_id,
                tournament=tournament,
                recipient_emails=approved_emails,
            )
        await _notify_organizers(
            session,
            org_id=org_id,
            type="tournament.went_live",
            data={"tournament_id": str(tournament.id), "tournament_name": tournament.name},
        )
    elif new_status is TournamentStatus.COMPLETED:
        await _notify_organizers(
            session,
            org_id=org_id,
            type="tournament.completed",
            data={"tournament_id": str(tournament.id), "tournament_name": tournament.name},
        )
    await get_cache().delete(cache_keys.public_tournament_keys(tournament.id)["overview"])
    return tournament


async def publish(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    tournament_id: uuid.UUID,
    artifacts: list[str],
) -> Tournament:
    tournament = await _require_tournament(session, org_id, tournament_id)
    now = _now()
    for artifact in artifacts:
        field = _PUBLISH_FIELDS.get(artifact)
        if field is None:
            raise ValidationError(f"unknown artifact {artifact!r}", code="unknown_artifact")
        setattr(tournament, field, now)
    await session.flush()
    await _audit_event(
        session,
        org_id,
        actor_id,
        events.TOURNAMENT_PUBLISHED,
        tournament.id,
        after={"artifacts": artifacts},
    )
    if "draw" in artifacts:
        registrations = await registrations_repo.list_registrations_for_tournament(
            session, org_id, tournament.id
        )
        emails: set[str] = set()
        user_ids: set[uuid.UUID] = set()
        for reg in registrations:
            form = reg.form_response or {}
            email = form.get("email")
            if email and str(email).strip():
                emails.add(str(email).strip().lower())
            if reg.submitted_by is not None:
                user_ids.add(reg.submitted_by)
        participants = await registrations_repo.list_participants_for_tournament(
            session, org_id, tournament.id
        )
        for p in participants:
            if p.user_id is not None:
                user_ids.add(p.user_id)
        if emails or user_ids:
            await reg_notifications.notify_draw_published(
                session,
                org_id=org_id,
                tournament=tournament,
                recipient_emails=emails,
                recipient_user_ids=user_ids,
            )
    await get_cache().delete_many(list(cache_keys.public_tournament_keys(tournament.id).values()))
    return tournament


# ---- division / stage ----


async def create_division(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    tournament_id: uuid.UUID,
    name: str,
    participant_type: ParticipantKind,
    capacity: int | None,
    reg_form: dict[str, Any],
) -> Division:
    tournament = await _require_tournament(session, org_id, tournament_id)
    profile = get_sport_registry().get(await _sport_key(session, tournament))
    if participant_type not in profile.supported_participant_kinds():
        raise ValidationError(
            f"{profile.key} does not support {participant_type.value}",
            code="unsupported_participant_type",
        )
    division = Division(
        organization_id=org_id,
        tournament_id=tournament.id,
        name=name,
        participant_type=participant_type.value,
        capacity=capacity,
        reg_form=reg_form,
    )
    session.add(division)
    await session.flush()
    await _audit_event(
        session, org_id, actor_id, events.DIVISION_CREATED, division.id, after={"name": name}
    )
    return division


async def update_division(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    division_id: uuid.UUID,
    name: str | None,
    participant_type: ParticipantKind | None,
    capacity: int | None,
    clear_capacity: bool,
) -> Division:
    division = await _require_division(session, org_id, division_id)
    if name is not None:
        division.name = name
    if participant_type is not None:
        tournament = await _require_tournament(session, org_id, division.tournament_id)
        profile = get_sport_registry().get(await _sport_key(session, tournament))
        if participant_type not in profile.supported_participant_kinds():
            raise ValidationError(
                f"{profile.key} does not support {participant_type.value}",
                code="unsupported_participant_type",
            )
        division.participant_type = participant_type.value
    if clear_capacity:
        division.capacity = None
    elif capacity is not None:
        division.capacity = capacity
    await session.flush()
    await _audit_event(session, org_id, actor_id, events.DIVISION_CREATED, division.id)
    return division


async def create_stage(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    division_id: uuid.UUID,
    stage_format: str,
    seq: int,
    config: dict[str, Any],
    points_rule_id: uuid.UUID | None,
    tiebreak_ruleset_id: uuid.UUID | None,
    advances_n: int | None,
) -> Stage:
    division = await _require_division(session, org_id, division_id)
    fmt = FormatKey(stage_format)
    registry = get_format_registry()
    if not registry.is_registered(fmt):
        raise ValidationError(
            f"format {stage_format!r} is not available", code="unsupported_format"
        )
    try:
        registry.get(fmt).validate_config(config)
    except EngineValidationError as exc:
        raise ValidationError(str(exc), code="invalid_stage_config") from exc
    tournament = await _require_tournament(session, org_id, division.tournament_id)
    profile = get_sport_registry().get(await _sport_key(session, tournament))
    sport_cfg = merge_sport_config(
        profile,
        tournament_settings=tournament.settings or {},
        stage_config=config,
    )
    try:
        profile.validate_config(sport_cfg)
    except EngineValidationError as exc:
        raise ValidationError(str(exc), code="invalid_sport_config") from exc
    stage = Stage(
        organization_id=org_id,
        division_id=division.id,
        type=stage_format,
        seq=seq,
        config=config,
        points_rule_id=points_rule_id,
        tiebreak_ruleset_id=tiebreak_ruleset_id,
        advances_n=advances_n,
    )
    session.add(stage)
    await session.flush()
    await _audit_event(session, org_id, actor_id, events.STAGE_CREATED, stage.id)
    return stage


async def update_stage_config(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    division_id: uuid.UUID,
    stage_id: uuid.UUID,
    config: dict[str, Any],
) -> Stage:
    """Merge new sport-config keys into stage.config. Blocked once any match result exists."""
    stage = await _require_stage(session, org_id, stage_id)
    if stage.division_id != division_id:
        raise NotFoundError("Stage not found in this division")
    if await repo.stage_has_scored_matches(session, org_id, stage.id):
        raise ConflictError(
            "stage config is locked once a match result has been recorded",
            code="stage_locked",
        )
    division = await _require_division(session, org_id, stage.division_id)
    tournament = await _require_tournament(session, org_id, division.tournament_id)
    profile = get_sport_registry().get(await _sport_key(session, tournament))
    merged_config = {**(stage.config or {}), **config}
    sport_cfg = merge_sport_config(
        profile,
        tournament_settings=tournament.settings or {},
        stage_config=merged_config,
    )
    try:
        profile.validate_config(sport_cfg)
    except EngineValidationError as exc:
        raise ValidationError(str(exc), code="invalid_sport_config") from exc
    stage.config = merged_config
    await session.flush()
    await _audit_event(session, org_id, actor_id, events.STAGE_CREATED, stage.id)
    return stage


# ---- draw generation (engine orchestration) ----


async def generate_draw(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    stage_id: uuid.UUID,
    rng_seed: int | None,
    override_readiness: bool = False,
) -> tuple[Stage, dict[str, Any]]:
    stage = await _require_stage(session, org_id, stage_id)
    if await repo.stage_match_count(session, org_id, stage.id) > 0:
        raise ConflictError("this stage has already been drawn")
    division = await _require_division(session, org_id, stage.division_id)
    tournament = await _require_tournament(session, org_id, division.tournament_id)

    # A franchise division is drawn as team-vs-team ties, each holding several
    # doubles matches — a different structure this generic draw cannot build. It
    # used to run anyway and pull every entrant level at once (players, their pairs
    # and their squads), drawing them all against each other.
    if division.participant_type == ParticipantKind.SQUAD.value:
        raise ValidationError(
            "this is a team division — use the team draw to generate fixtures",
            code="use_franchise_draw",
        )

    # Only the entrants the division actually fields — see approved_participants.
    participants = list(
        await repo.approved_participants(
            session, org_id, division.id, kind=division.participant_type
        )
    )
    if len(participants) < 2:
        raise ValidationError(
            "at least 2 approved participants are required to draw", code="too_few_participants"
        )
    # Check-in gate: don't draw with un-checked-in players unless the organizer
    # explicitly overrides. Attendance is a fact about people, so this looks at the
    # individual rows — a pair or a franchise team can never check in itself, and
    # gating on those would block the draw permanently once pairs exist.
    if not override_readiness:
        people = list(
            await repo.approved_participants(
                session, org_id, division.id, kind=ParticipantKind.INDIVIDUAL.value
            )
        ) or list(participants)
        not_checked_in = sum(1 for p in people if p.attendance != AttendanceStatus.CHECKED_IN.value)
        if not_checked_in:
            raise ValidationError(
                f"{not_checked_in} of {len(people)} players haven't checked in — "
                "check them in or override to draw anyway",
                code="checkin_incomplete",
            )
    # The domain owns ordering: seed order from the DB, or a reproducible random draw.
    # Participants are passed to the engine in final order (rng_seed=None) so the plan's
    # SeedRef(n) maps deterministically to participants[n-1] here.
    if rng_seed is not None:
        random.Random(rng_seed).shuffle(participants)

    fmt = FormatKey(stage.type)
    refs = tuple(ParticipantRef(id=str(p.id), seed=p.seed) for p in participants)
    try:
        plan = (
            get_format_registry()
            .get(fmt)
            .generate(
                GenerateRequest(format=fmt, participants=refs, config=stage.config, rng_seed=None)
            )
        )
    except EngineValidationError as exc:
        raise ValidationError(str(exc), code="draw_failed") from exc

    summary = await _persist_structure(session, org_id, tournament.id, stage, plan, participants)
    await resolve_bracket(session, org_id, stage)  # resolve byes into walkovers immediately
    await _audit_event(session, org_id, actor_id, events.STAGE_GENERATED, stage.id, after=summary)
    await _notify_organizers(
        session,
        org_id=org_id,
        type="stage.draw_generated",
        data={
            "tournament_id": str(tournament.id),
            "stage_name": stage.type,
        },
    )
    return stage, summary


async def advance_to_knockout(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    source_stage_id: uuid.UUID,
    take: int,
    rng_seed: int | None = None,
) -> tuple[Stage, dict[str, Any]]:
    """Take the top-``take`` ranked participants from a completed stage's standings and
    create + draw a new single-elimination stage in the same division."""
    source_stage = await _require_stage(session, org_id, source_stage_id)
    division = await _require_division(session, org_id, source_stage.division_id)

    if take < 2:
        raise ValidationError("take must be at least 2", code="invalid_take")

    standings = await scoring_repo.stage_standings(session, org_id, source_stage_id)
    ranked = sorted(
        [s for s in standings if s.rank is not None],
        key=lambda s: (s.rank, s.participant_id),
    )
    top_ids = {str(s.participant_id) for s in ranked[:take]}
    if len(top_ids) < 2:
        raise ValidationError(
            "not enough ranked participants in standings — run standings first",
            code="too_few_ranked",
        )

    participants = list(
        await repo.approved_participants(
            session, org_id, division.id, kind=division.participant_type
        )
    )
    ko_participants = [p for p in participants if str(p.id) in top_ids]
    if len(ko_participants) < 2:
        raise ValidationError(
            "could not find participant records for top-ranked entrants",
            code="participants_not_found",
        )

    next_seq = (source_stage.seq or 0) + 1
    ko_stage = Stage(
        organization_id=org_id,
        division_id=division.id,
        type=FormatKey.SINGLE_ELIM.value,
        seq=next_seq,
        config={},
        advances_n=None,
    )
    session.add(ko_stage)
    await session.flush()

    if rng_seed is not None:
        random.Random(rng_seed).shuffle(ko_participants)

    refs = tuple(ParticipantRef(id=str(p.id), seed=p.seed) for p in ko_participants)
    fmt = FormatKey.SINGLE_ELIM
    try:
        plan = (
            get_format_registry()
            .get(fmt)
            .generate(GenerateRequest(format=fmt, participants=refs, config={}, rng_seed=None))
        )
    except EngineValidationError as exc:
        raise ValidationError(str(exc), code="draw_failed") from exc

    tournament = await _require_tournament(session, org_id, division.tournament_id)
    summary = await _persist_structure(
        session, org_id, tournament.id, ko_stage, plan, ko_participants
    )
    await resolve_bracket(session, org_id, ko_stage)
    await _audit_event(
        session, org_id, actor_id, events.STAGE_GENERATED, ko_stage.id, after=summary
    )
    await _notify_organizers(
        session,
        org_id=org_id,
        type="stage.knockout_generated",
        data={"tournament_id": str(tournament.id)},
    )
    return ko_stage, summary


async def clear_draw(
    session: AsyncSession, *, org_id: uuid.UUID, actor_id: uuid.UUID, stage_id: uuid.UUID
) -> Stage:
    """Wipe a stage's draw (matches/rounds/groups/standings) so it can be regenerated —
    the "regenerate" flow is clear-then-draw, two small auditable steps rather than one
    endpoint that does both. Only safe before anything has actually been played: blocked
    once any match has a real submitted result, even if every match is still otherwise
    pending/scheduled (byes auto-resolved into walkovers at draw time don't count — see
    `stage_has_scored_matches`)."""
    stage = await _require_stage(session, org_id, stage_id)
    if await repo.stage_match_count(session, org_id, stage.id) == 0:
        raise ConflictError("this stage has not been drawn yet")
    if await repo.stage_has_scored_matches(session, org_id, stage.id):
        raise ConflictError("cannot clear a draw that already has scored matches")
    await repo.delete_stage_draw(session, org_id, stage.id)
    await _audit_event(session, org_id, actor_id, events.STAGE_DRAW_CLEARED, stage.id)
    return stage


async def resolve_bracket(session: AsyncSession, org_id: uuid.UUID, stage: Stage) -> dict[str, Any]:
    """Advance a bracket: reconstruct it from persisted rows, run the pure
    AdvancementEngine over completed winners, then sync the DB — create newly-resolved
    match sides, auto-decide byes as walkovers, and flip pending → scheduled. Idempotent;
    a no-op for formats without winner_of/bye refs (e.g. round robin). Returns the ids of
    matches newly made playable (for downstream notifications)."""
    matches = list(await repo.stage_matches_with_participants(session, org_id, stage.id))
    if not matches:
        return {"activated": 0, "scheduled": []}

    plans: list[MatchPlan] = []
    winners: dict[str, str] = {}
    for match in matches:
        raw = match.source_refs or {}
        source_refs = parse_source_refs(raw) if raw.get("sides") else SourceRefs(())
        plans.append(MatchPlan(key=str(match.id), source_refs=source_refs))
        if match.status in _TERMINAL_STATUSES:
            winner = next(
                (mp for mp in match.participants if mp.outcome == MatchOutcome.WIN.value), None
            )
            if winner is not None:
                winners[str(match.id)] = str(winner.participant_id)

    result = get_advancement_engine().resolve(
        AdvancementRequest(matches=tuple(plans), seeds={}, winners=winners)
    )

    activated = 0
    scheduled: list[str] = []
    for match in matches:
        sides = result.sides[str(match.id)]
        existing = {str(mp.participant_id) for mp in match.participants}
        for side in sides:
            if side.participant_id and side.participant_id not in existing:
                session.add(
                    MatchParticipant(
                        organization_id=org_id,
                        match_id=match.id,
                        participant_id=uuid.UUID(side.participant_id),
                    )
                )
                existing.add(side.participant_id)
        if match.status != MatchStatus.PENDING.value:
            continue
        if str(match.id) in result.byes:
            match.status = MatchStatus.WALKOVER.value
            winner_id = result.winners.get(str(match.id))
            for mp in match.participants:
                if str(mp.participant_id) == winner_id:
                    mp.outcome = MatchOutcome.WIN.value
            activated += 1
        elif sides and all(side.participant_id is not None for side in sides):
            match.status = MatchStatus.SCHEDULED.value
            scheduled.append(str(match.id))
            activated += 1

    await session.flush()
    return {"activated": activated, "scheduled": scheduled}


def references_match(matches: list[Match], match_id: uuid.UUID) -> bool:
    """True if any match feeds off ``match_id`` (winner_of/loser_of) — i.e. it has a
    downstream dependent in the bracket (used to guard winner-changing corrections)."""
    target = str(match_id)
    for match in matches:
        for side in (match.source_refs or {}).get("sides", []):
            if isinstance(side, dict) and (
                side.get("winner_of") == target or side.get("loser_of") == target
            ):
                return True
    return False


async def _persist_structure(
    session: AsyncSession,
    org_id: uuid.UUID,
    tournament_id: uuid.UUID,
    stage: Stage,
    plan: StructurePlan,
    participants: list[Participant],
) -> dict[str, Any]:
    # Pre-assign IDs so we can build all FK references in-memory before any flush.
    group_id_by_key: dict[str, uuid.UUID] = {}
    for group_plan in plan.groups:
        gid = _uuid7()
        group = Group(id=gid, organization_id=org_id, stage_id=stage.id, name=group_plan.name)
        session.add(group)
        group_id_by_key[group_plan.key] = gid

    round_id_by_key: dict[str, uuid.UUID] = {}
    for round_plan in plan.rounds:
        rid = _uuid7()
        rnd = Round(
            id=rid,
            organization_id=org_id,
            stage_id=stage.id,
            seq=round_plan.seq,
            label=round_plan.label,
        )
        session.add(rnd)
        round_id_by_key[round_plan.key] = rid

    # Groups and rounds must be persisted before matches reference their IDs via FK.
    # Match.round is viewonly=True so SQLAlchemy's UoW won't order Round→Match for us;
    # a single flush here keeps us at 2 round-trips instead of the original 500+.
    await session.flush()

    seed_to_participant = {i + 1: participants[i] for i in range(len(participants))}
    participant_by_str = {str(p.id): p for p in participants}

    # Pass 1: create Match rows so winner_of refs can be translated to real UUIDs.
    # IDs are pre-generated so MatchParticipant FKs can be set in Pass 2 without a flush.
    match_by_key: dict[str, Match] = {}
    for match_plan in plan.matches:
        mid = _uuid7()
        match = Match(
            id=mid,
            organization_id=org_id,
            tournament_id=tournament_id,
            stage_id=stage.id,
            round_id=round_id_by_key.get(match_plan.round_key) if match_plan.round_key else None,
            group_id=group_id_by_key.get(match_plan.group_key) if match_plan.group_key else None,
            status=MatchStatus.PENDING.value,
            result_payload={},
            source_refs={},
        )
        session.add(match)
        match_by_key[match_plan.key] = match

    scheduled = pending = 0
    for match_plan in plan.matches:
        match = match_by_key[match_plan.key]
        sides_json: list[dict[str, Any]] = []
        resolved: list[Participant] = []
        has_ref = has_bye = False
        for side in match_plan.source_refs.sides:
            if isinstance(side, SeedRef):
                part = seed_to_participant[side.seed]
                sides_json.append({"participant": str(part.id)})
                resolved.append(part)
            elif isinstance(side, ParticipantSideRef):
                part = participant_by_str[side.participant_id]
                sides_json.append({"participant": str(part.id)})
                resolved.append(part)
            elif isinstance(side, WinnerOfRef):
                sides_json.append({"winner_of": str(match_by_key[side.match_key].id)})
                has_ref = True
            elif isinstance(side, LoserOfRef):
                sides_json.append({"loser_of": str(match_by_key[side.match_key].id)})
                has_ref = True
            elif isinstance(side, ByeRef):
                sides_json.append({"bye": True})
                has_bye = True
        match.source_refs = {"sides": sides_json}
        for part in resolved:
            session.add(
                MatchParticipant(organization_id=org_id, match_id=match.id, participant_id=part.id)
            )
        fully_known = (
            not has_ref and not has_bye and len(resolved) == len(match_plan.source_refs.sides)
        )
        match.status = (MatchStatus.SCHEDULED if fully_known else MatchStatus.PENDING).value
        if fully_known:
            scheduled += 1
        else:
            pending += 1

    await session.flush()
    return {
        "format": plan.format.value,
        "groups": len(plan.groups),
        "rounds": len(plan.rounds),
        "matches": len(plan.matches),
        "scheduled": scheduled,
        "pending": pending,
    }


# ---- helpers ----


async def _ensure_sport_profile(session: AsyncSession, org_id: uuid.UUID, key: str) -> SportProfile:
    existing = await repo.get_sport_profile_by_key(session, org_id, key)
    if existing is not None:
        return existing
    engine_profile = get_sport_registry().get(key)
    kinds = engine_profile.supported_participant_kinds()
    default_kind = (
        ParticipantKind.INDIVIDUAL if ParticipantKind.INDIVIDUAL in kinds else next(iter(kinds))
    )
    row = SportProfile(
        organization_id=org_id,
        key=key,
        name=key.replace("_", " ").title(),
        participant_type=default_kind.value,
        result_schema={},
        win_rules={},
        defaults=dict(engine_profile.default_config()),
    )
    session.add(row)
    await session.flush()
    return row


async def _sport_key(session: AsyncSession, tournament: Tournament) -> str:
    profile = await repo.get_sport_profile(session, tournament.sport_profile_id)
    if profile is None:  # pragma: no cover - FK guarantees presence
        raise NotFoundError("Sport profile not found")
    return profile.key


async def _require_tournament(
    session: AsyncSession, org_id: uuid.UUID, tid: uuid.UUID
) -> Tournament:
    tournament = await repo.get_tournament(session, org_id, tid)
    if tournament is None:
        raise NotFoundError("Tournament not found")
    return tournament


async def _require_division(session: AsyncSession, org_id: uuid.UUID, did: uuid.UUID) -> Division:
    division = await repo.get_division(session, org_id, did)
    if division is None:
        raise NotFoundError("Division not found")
    return division


async def _require_stage(session: AsyncSession, org_id: uuid.UUID, sid: uuid.UUID) -> Stage:
    stage = await repo.get_stage(session, org_id, sid)
    if stage is None:
        raise NotFoundError("Stage not found")
    return stage


async def _audit_event(
    session: AsyncSession,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    action: str,
    entity_id: uuid.UUID,
    *,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
) -> None:
    entity = action.split(".", 1)[0]
    audit.record(
        session,
        organization_id=org_id,
        actor_id=actor_id,
        action=action,
        entity=entity,
        entity_id=entity_id,
        before=before,
        after=after,
    )
    await emit_event(
        session,
        aggregate=entity,
        event_type=action,
        payload={"id": str(entity_id), "organizationId": str(org_id)},
    )
