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

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ConflictError, NotFoundError, ValidationError
from app.core import audit
from app.core.events import emit_event
from app.core.factory import get_format_registry, get_sport_registry
from app.db.enums import MatchStatus, ParticipantKind, TournamentStatus, Visibility
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
)
from app.engine import (
    ByeRef,
    EngineValidationError,
    FormatKey,
    GenerateRequest,
    LoserOfRef,
    ParticipantRef,
    ParticipantSideRef,
    SeedRef,
    StructurePlan,
    WinnerOfRef,
)
from app.modules.tournaments import events
from app.modules.tournaments import repository as repo

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
    if settings is not None:
        tournament.settings = settings
    if tournament.starts_at and tournament.ends_at and tournament.starts_at > tournament.ends_at:
        raise ValidationError("starts_at must be on or before ends_at")
    await session.flush()
    await _audit_event(session, org_id, actor_id, events.TOURNAMENT_UPDATED, tournament.id)
    return tournament


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


# ---- draw generation (engine orchestration) ----


async def generate_draw(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    stage_id: uuid.UUID,
    rng_seed: int | None,
) -> tuple[Stage, dict[str, Any]]:
    stage = await _require_stage(session, org_id, stage_id)
    if await repo.stage_match_count(session, org_id, stage.id) > 0:
        raise ConflictError("this stage has already been drawn")
    division = await _require_division(session, org_id, stage.division_id)
    tournament = await _require_tournament(session, org_id, division.tournament_id)

    participants = list(await repo.approved_participants(session, org_id, division.id))
    if len(participants) < 2:
        raise ValidationError(
            "at least 2 approved participants are required to draw", code="too_few_participants"
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
    await _audit_event(session, org_id, actor_id, events.STAGE_GENERATED, stage.id, after=summary)
    return stage, summary


async def _persist_structure(
    session: AsyncSession,
    org_id: uuid.UUID,
    tournament_id: uuid.UUID,
    stage: Stage,
    plan: StructurePlan,
    participants: list[Participant],
) -> dict[str, Any]:
    group_id_by_key: dict[str, uuid.UUID] = {}
    for group_plan in plan.groups:
        group = Group(organization_id=org_id, stage_id=stage.id, name=group_plan.name)
        session.add(group)
        await session.flush()
        group_id_by_key[group_plan.key] = group.id

    round_id_by_key: dict[str, uuid.UUID] = {}
    for round_plan in plan.rounds:
        rnd = Round(
            organization_id=org_id, stage_id=stage.id, seq=round_plan.seq, label=round_plan.label
        )
        session.add(rnd)
        await session.flush()
        round_id_by_key[round_plan.key] = rnd.id

    seed_to_participant = {i + 1: participants[i] for i in range(len(participants))}
    participant_by_str = {str(p.id): p for p in participants}

    # Pass 1: create Match rows so winner_of refs can be translated to real UUIDs.
    match_by_key: dict[str, Match] = {}
    for match_plan in plan.matches:
        match = Match(
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
        await session.flush()
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
