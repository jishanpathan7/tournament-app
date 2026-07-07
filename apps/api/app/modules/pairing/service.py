"""Smart Pairing use cases: generate a draft of skill-balanced teams, let the organizer
review / edit / lock / swap, then publish → materialize real Team + pair Participant rows.

Sport rules stay in the Sport Profile (skill→weight + policy) and the algorithm stays in
the engine (``FoldPairingEngine``). This module only orchestrates: load entrants, call the
engine, persist the draft, and on publish reuse the same Team/Participant construction the
registration module uses. Never commits — the request session owns the transaction.
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ConflictError, NotFoundError, ValidationError
from app.core import audit
from app.core.events import emit_event
from app.core.factory import get_broadcaster, get_sport_registry, get_team_formation_engine
from app.db.enums import PairingRunStatus, ParticipantKind, ParticipantStatus, RegistrationStatus
from app.db.models import (
    PairingRun,
    Participant,
    ProposedTeam,
    Registration,
    RosterEntry,
    Team,
)
from app.engine import (
    EngineValidationError,
    PairingConstraints,
    PairingEntrant,
    TeamFormationRequest,
    field_max_dev,
    pairing_confidence,
)
from app.modules.pairing import events
from app.modules.pairing import repository as repo
from app.modules.pairing.schemas import (
    EntrantView,
    PairingRunView,
    PairingSummary,
    ProposedTeamView,
)
from app.modules.registrations.entrant import (
    entrant_display_name,
    entrant_has_external_identity,
)
from app.modules.registrations.partner_resolution import preferred_partner_id_for
from app.modules.squads.repository import (
    cross_squad_forbidden_registration_pairs,
    list_squads,
    squad_membership_by_registration,
)
from app.realtime.channels import org_channel


class _Context:
    """Everything a pairing operation needs about a division."""

    def __init__(self, division: Any, profile: Any, policy: Any, entrants: list[Registration]):
        self.division = division
        self.profile = profile
        self.policy = policy
        self.entrants = entrants
        self.by_id: dict[str, Registration] = {str(r.id): r for r in entrants}


# ---- generate / regenerate ----


async def generate(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    division_id: uuid.UUID,
    rng_seed: int | None,
    forced_groups: list[list[uuid.UUID]],
    forbidden_pairs: list[list[uuid.UUID]],
    squad_id: uuid.UUID | None = None,
) -> PairingRun:
    """(Re)generate the draft for a division.

    When *squad_id* is provided only members of that squad are eligible — this is the
    franchise/SIBL flow where intra-team pairs must be formed after the draft ceremony.
    Any locked teams in the existing draft are carried over; the old draft is discarded.
    """
    ctx = await _load_context(session, org_id, division_id, squad_id=squad_id)

    if squad_id is None:
        # Division-wide run: keep pairs within squads by forbidding cross-squad pairs.
        membership = await squad_membership_by_registration(
            session, org_id, ctx.division.tournament_id
        )
        if membership:
            cross_squad = cross_squad_forbidden_registration_pairs(
                membership, [r.id for r in ctx.entrants]
            )
            forbidden_pairs = forbidden_pairs + [list(pair) for pair in cross_squad]

    prior = await repo.get_active_run(session, org_id, division_id, squad_id=squad_id)
    carried_locked, carried_names = _carry_locked(prior)
    if prior is not None:
        prior.status = PairingRunStatus.DISCARDED.value

    all_forced = [[str(m) for m in group] for group in forced_groups] + carried_locked
    constraints = PairingConstraints(
        forced_groups=tuple(tuple(g) for g in all_forced),
        forbidden_pairs=tuple((str(a), str(b)) for a, b in forbidden_pairs if a != b),
        prior_pairings=tuple(await repo.list_published_pairings(session, org_id, division_id)),
        avoid_repeats=True,
    )
    _validate_member_ids(all_forced, forbidden_pairs, ctx)

    entrants = _engine_entrants(ctx)
    target = ctx.policy.target_strength or _mean_target(entrants, ctx.policy.team_size)
    max_dev = field_max_dev([e.weight for e in entrants], ctx.policy.team_size, target)

    try:
        plan = get_team_formation_engine().form_teams(
            TeamFormationRequest(
                entrants=tuple(entrants),
                policy=ctx.policy,
                constraints=constraints,
                rng_seed=rng_seed,
            )
        )
    except EngineValidationError as exc:
        raise ValidationError(str(exc), code="invalid_pairing") from exc

    config: dict[str, Any] = {
        "target": str(target),
        "maxDev": str(max_dev),
        "teamSize": ctx.policy.team_size,
    }
    if squad_id is not None:
        config["squadId"] = str(squad_id)

    run = PairingRun(
        organization_id=org_id,
        division_id=division_id,
        status=PairingRunStatus.DRAFT.value,
        rng_seed=rng_seed,
        config=config,
    )
    session.add(run)
    await session.flush()

    # A team is "locked" (pinned to survive future regenerates) when its members were
    # explicitly forced — whether carried over from a prior draft or forced in this call.
    locked_sets = carried_locked_sets(all_forced)
    for team in plan.teams:
        members = frozenset(team.member_ids)
        session.add(
            ProposedTeam(
                organization_id=org_id,
                pairing_run_id=run.id,
                member_ids=list(team.member_ids),
                strength=team.strength,
                confidence=team.confidence,
                reasons=list(team.reasons),
                locked=members in locked_sets,
                team_name=carried_names.get(members),
            )
        )
    await session.flush()

    await _emit(session, org_id, actor_id, run, events.PAIRING_GENERATED)
    return run


def _carry_locked(
    prior: PairingRun | None,
) -> tuple[list[list[str]], dict[frozenset[str], str | None]]:
    """Locked teams from the prior draft → (forced groups, name-by-members) to preserve."""
    if prior is None:
        return [], {}
    groups: list[list[str]] = []
    names: dict[frozenset[str], str | None] = {}
    for team in prior.proposed_teams:
        if team.locked:
            members = [str(m) for m in team.member_ids]
            groups.append(members)
            names[frozenset(members)] = team.team_name
    return groups, names


def carried_locked_sets(groups: list[list[str]]) -> set[frozenset[str]]:
    return {frozenset(g) for g in groups}


# ---- read ----


async def get_active_run(
    session: AsyncSession,
    org_id: uuid.UUID,
    division_id: uuid.UUID,
    squad_id: uuid.UUID | None = None,
) -> PairingRun | None:
    await _load_context(session, org_id, division_id)  # validates division exists
    return await repo.get_active_run(session, org_id, division_id, squad_id=squad_id)


# ---- edit ----


async def update_team(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    team_id: uuid.UUID,
    locked: bool | None,
    team_name: str | None,
    clear_team_name: bool,
) -> ProposedTeam:
    team = await _require_draft_team(session, org_id, team_id)
    if locked is not None:
        team.locked = locked
    if clear_team_name:
        team.team_name = None
    elif team_name is not None:
        team.team_name = team_name
    await session.flush()
    run = await repo.get_run(session, org_id, team.pairing_run_id)
    if run is not None:
        await _emit(session, org_id, actor_id, run, events.PAIRING_EDITED)
    return team


async def swap_members(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    run_id: uuid.UUID,
    member_a: uuid.UUID,
    member_b: uuid.UUID,
) -> PairingRun:
    """Swap two members between their (different) teams — a manual override — and re-score
    the two affected teams."""
    run = await _require_draft_run(session, org_id, run_id)
    if member_a == member_b:
        raise ValidationError("cannot swap a member with itself", code="invalid_swap")

    a_id, b_id = str(member_a), str(member_b)
    team_a = _team_containing(run, a_id)
    team_b = _team_containing(run, b_id)
    if team_a is None or team_b is None:
        raise NotFoundError("member not found in this run")
    if team_a.id == team_b.id:
        raise ValidationError("both members are already on the same team", code="invalid_swap")

    team_a.member_ids = [b_id if m == a_id else m for m in team_a.member_ids]
    team_b.member_ids = [a_id if m == b_id else m for m in team_b.member_ids]
    # A manual swap breaks the "requested/locked" provenance — mark both as manual.
    for team in (team_a, team_b):
        team.reasons = ["Manually adjusted by organizer"]

    ctx = await _load_context(session, org_id, run.division_id)
    weights = {str(r.id): ctx.profile.skill_weight(r.skill_level) for r in ctx.entrants}
    target, max_dev = _run_bounds(run)
    for team in (team_a, team_b):
        strength = sum((weights.get(m, Decimal(0)) for m in team.member_ids), Decimal(0))
        team.strength = strength
        team.confidence = pairing_confidence(strength, target, max_dev)

    await session.flush()
    await _emit(session, org_id, actor_id, run, events.PAIRING_EDITED)
    return run


# ---- publish ----


async def publish(
    session: AsyncSession, *, org_id: uuid.UUID, actor_id: uuid.UUID, run_id: uuid.UUID
) -> tuple[int, int]:
    """Materialize a draft run's teams into Team + pair Participant rows, linking each
    source registration. Returns (published_teams, unpaired_count)."""
    run = await _require_draft_run(session, org_id, run_id)
    ctx = await _load_context(session, org_id, run.division_id)

    paired_ids: set[str] = set()
    published = 0
    for team in run.proposed_teams:
        members = [str(m) for m in team.member_ids]
        regs = [ctx.by_id.get(m) for m in members]
        if any(r is None for r in regs):
            raise ConflictError(
                "a proposed team references an entrant that is no longer eligible; regenerate",
                code="stale_pairing",
            )
        await _materialize_team(session, org_id, ctx, team, [r for r in regs if r is not None])
        paired_ids.update(members)
        published += 1

    run.status = PairingRunStatus.PUBLISHED.value
    await session.flush()

    unpaired = sum(1 for r in ctx.entrants if str(r.id) not in paired_ids)
    await _emit(session, org_id, actor_id, run, events.PAIRING_PUBLISHED)
    return published, unpaired


async def repair_published_rosters(
    session: AsyncSession, *, org_id: uuid.UUID, division_id: uuid.UUID
) -> int:
    """Backfill team + roster display names from registration form_response.

    Needed when pairings were published before imported entrant names were honored
    (organizer account was written onto every roster row).
    """
    await _load_context(session, org_id, division_id)
    run = await repo.get_latest_published_run(session, org_id, division_id)
    if run is None:
        raise NotFoundError("No published pairing run found for this division")

    proposed = sorted(run.proposed_teams, key=lambda t: (t.created_at, t.id))
    participants = list(await repo.list_pair_participants(session, org_id, division_id))
    if len(proposed) != len(participants):
        raise ValidationError(
            "published pairing no longer matches materialized participants; regenerate pairing",
            code="stale_pairing",
        )

    repaired = 0
    for proposed_team, participant in zip(proposed, participants, strict=True):
        regs: list[Registration] = []
        for member_id in proposed_team.member_ids:
            reg = await session.get(Registration, uuid.UUID(str(member_id)))
            if reg is None or reg.organization_id != org_id:
                raise ValidationError(
                    f"registration {member_id} not found for this division",
                    code="stale_pairing",
                )
            regs.append(reg)

        if participant.team_id is None:
            raise ValidationError("pair participant has no team", code="stale_pairing")
        team = await repo.get_team_with_roster(session, org_id, participant.team_id)
        if team is None:
            raise NotFoundError("Team not found")

        names = [_entrant_name(reg) for reg in regs]
        team_name = proposed_team.team_name or (" / ".join(names) if names else team.name)
        team.name = team_name
        participant.display_name = team_name

        entries = sorted(team.roster_entries, key=lambda e: (e.created_at, e.id))
        if len(entries) != len(regs):
            raise ValidationError(
                "roster size does not match pairing members", code="stale_pairing"
            )
        for entry, reg in zip(entries, regs, strict=True):
            user = await repo.get_user(session, reg.submitted_by)
            account_name = user.name if user else None
            entry.external_name = entrant_display_name(reg, account_name=account_name)
            entry.user_id = None if entrant_has_external_identity(reg) else reg.submitted_by
        repaired += 1

    await session.flush()
    return repaired


async def _materialize_team(
    session: AsyncSession,
    org_id: uuid.UUID,
    ctx: _Context,
    team: ProposedTeam,
    regs: list[Registration],
) -> None:
    member_names = [_entrant_name(reg) for reg in regs]
    name = team.team_name or (
        " / ".join(member_names) if member_names else f"Team {str(team.id)[:8]}"
    )
    captain = regs[0].submitted_by if regs else None
    team_row = Team(organization_id=org_id, name=name, captain_user_id=captain)
    session.add(team_row)
    await session.flush()
    for reg in regs:
        user = await repo.get_user(session, reg.submitted_by)
        account_name = user.name if user else None
        session.add(
            RosterEntry(
                organization_id=org_id,
                team_id=team_row.id,
                user_id=None if entrant_has_external_identity(reg) else reg.submitted_by,
                external_name=entrant_display_name(reg, account_name=account_name),
            )
        )
    participant = Participant(
        organization_id=org_id,
        division_id=ctx.division.id,
        kind=ParticipantKind.PAIR.value,
        team_id=team_row.id,
        display_name=name,
        status=ParticipantStatus.APPROVED.value,
    )
    session.add(participant)
    await session.flush()
    # A pair Participant is owned by TWO registrations, so we can't use the 1:1
    # registrations.participant_id link (unique) — the roster carries the members. We
    # just move the source registrations to `approved`, which drops them from the pool.
    for reg in regs:
        reg.status = RegistrationStatus.APPROVED.value
    await session.flush()


# ---- context + helpers ----


async def _load_context(
    session: AsyncSession,
    org_id: uuid.UUID,
    division_id: uuid.UUID,
    squad_id: uuid.UUID | None = None,
) -> _Context:
    division = await repo.get_division(session, org_id, division_id)
    if division is None:
        raise NotFoundError("Division not found")
    tournament = await repo.get_tournament(session, org_id, division.tournament_id)
    if tournament is None:  # pragma: no cover
        raise NotFoundError("Tournament not found")
    profile_row = await repo.get_sport_profile(session, tournament.sport_profile_id)
    if profile_row is None:  # pragma: no cover
        raise NotFoundError("Sport profile not found")
    profile = get_sport_registry().get(profile_row.key)
    policy = profile.pairing_policy({"participantType": division.participant_type})
    # Franchise (squad-scoped) flow: players registered as individuals, paired into
    # doubles within their squad.  Requires an explicit squad_id; without one, a
    # singles division must be rejected — not silently re-routed to the doubles policy.
    is_franchise = squad_id is not None
    if not policy.supports_pairing and not is_franchise:
        raise ValidationError(
            "pairing is not supported for this division type",
            code="pairing_unsupported",
        )
    if is_franchise:
        policy = profile.pairing_policy({"participantType": "pair"})
        entrants = list(await repo.list_approved_registrations(session, org_id, division_id))
    else:
        entrants = list(await repo.list_eligible_registrations(session, org_id, division_id))

    # Narrow to squad members when running per-squad pairing (franchise/SIBL flow).
    if squad_id is not None:
        membership = await squad_membership_by_registration(session, org_id, tournament.id)
        squad_reg_ids = {reg_id for reg_id, sid in membership.items() if sid == squad_id}
        if not squad_reg_ids:
            raise ValidationError(
                "squad has no assigned members — complete the draft ceremony first",
                code="squad_empty",
            )
        entrants = [e for e in entrants if e.id in squad_reg_ids]

    return _Context(division, profile, policy, entrants)


def _engine_entrants(ctx: _Context) -> list[PairingEntrant]:
    out: list[PairingEntrant] = []
    for reg in ctx.entrants:
        pref_id = preferred_partner_id_for(reg, by_id=ctx.by_id)
        out.append(
            PairingEntrant(
                id=str(reg.id),
                weight=ctx.profile.skill_weight(reg.skill_level),
                display_name=str(reg.form_response.get("name") or ""),
                preferred_partner_id=pref_id,
            )
        )
    return out


def _mean_target(entrants: list[PairingEntrant], team_size: int) -> Decimal:
    if not entrants:
        return Decimal(0)
    total = sum((e.weight for e in entrants), Decimal(0))
    return (total / Decimal(len(entrants))) * Decimal(team_size)


def _run_bounds(run: PairingRun) -> tuple[Decimal, Decimal]:
    cfg = run.config or {}
    return Decimal(str(cfg.get("target", "0"))), Decimal(str(cfg.get("maxDev", "0")))


def _team_containing(run: PairingRun, member_id: str) -> ProposedTeam | None:
    for team in run.proposed_teams:
        if member_id in [str(m) for m in team.member_ids]:
            return team
    return None


def _validate_member_ids(
    forced: list[list[str]],
    forbidden: list[list[uuid.UUID]],
    ctx: _Context,
) -> None:
    known = set(ctx.by_id)
    for group in forced:
        for mid in group:
            if mid not in known:
                raise ValidationError(
                    f"forced group references unknown entrant {mid}", code="invalid_pairing"
                )
    for pair in forbidden:
        for pid in pair:
            if str(pid) not in known:
                raise ValidationError(
                    f"forbidden pair references unknown entrant {pid}", code="invalid_pairing"
                )


async def _require_draft_run(
    session: AsyncSession, org_id: uuid.UUID, run_id: uuid.UUID
) -> PairingRun:
    run = await repo.get_run(session, org_id, run_id)
    if run is None:
        raise NotFoundError("Pairing run not found")
    if run.status != PairingRunStatus.DRAFT.value:
        raise ConflictError(f"pairing run is {run.status}, not editable", code="not_draft")
    return run


async def _require_draft_team(
    session: AsyncSession, org_id: uuid.UUID, team_id: uuid.UUID
) -> ProposedTeam:
    team = await repo.get_proposed_team(session, org_id, team_id)
    if team is None:
        raise NotFoundError("Proposed team not found")
    run = await repo.get_run(session, org_id, team.pairing_run_id)
    if run is None or run.status != PairingRunStatus.DRAFT.value:
        raise ConflictError("pairing run is not editable", code="not_draft")
    return team


async def build_run_view(
    session: AsyncSession, org_id: uuid.UUID, run: PairingRun
) -> PairingRunView:
    """Assemble the full organizer-facing view: entrants (with resolved names + weights),
    proposed teams, the odd-one-out reserves, and summary stats."""
    # Reload with proposed_teams eagerly loaded — a freshly-created run's relationship
    # isn't populated, and a lazy load would fail in this async context.
    loaded = await repo.get_run(session, org_id, run.id)
    if loaded is not None:
        run = loaded
    ctx = await _load_context(session, org_id, run.division_id)

    # Build reg_id → squad_name map for display
    squads = await list_squads(session, org_id, ctx.division.tournament_id)
    reg_to_squad_name: dict[str, str] = {}
    for squad in squads:
        for member in squad.members:
            reg_to_squad_name[str(member.registration_id)] = squad.name

    entrants = [
        EntrantView(
            registration_id=r.id,
            display_name=_entrant_name(r),
            skill_level=r.skill_level,
            weight=float(ctx.profile.skill_weight(r.skill_level)),
            preferred_partner_id=_pref_uuid(r, ctx),
            squad_name=reg_to_squad_name.get(str(r.id)),
        )
        for r in ctx.entrants
    ]
    teams = sorted(run.proposed_teams, key=lambda t: (str(t.created_at), str(t.id)))
    team_views = [
        ProposedTeamView(
            id=t.id,
            member_ids=[uuid.UUID(m) for m in t.member_ids],
            strength=float(t.strength),
            confidence=float(t.confidence),
            reasons=list(t.reasons or []),
            locked=t.locked,
            team_name=t.team_name,
        )
        for t in teams
    ]
    paired = {str(m) for t in teams for m in t.member_ids}
    unpaired = [r.id for r in ctx.entrants if str(r.id) not in paired]
    confidences = [float(t.confidence) for t in teams]
    summary = PairingSummary(
        team_count=len(team_views),
        entrant_count=len(entrants),
        unpaired_count=len(unpaired),
        average_confidence=round(sum(confidences) / len(confidences), 3) if confidences else 0.0,
    )
    squad_id_str = (run.config or {}).get("squadId")
    squad_id = uuid.UUID(squad_id_str) if squad_id_str else None

    return PairingRunView(
        id=run.id,
        division_id=run.division_id,
        squad_id=squad_id,
        status=run.status,
        rng_seed=run.rng_seed,
        entrants=entrants,
        teams=team_views,
        unpaired_ids=unpaired,
        summary=summary,
    )


def _entrant_name(reg: Registration) -> str:
    return str(reg.form_response.get("name") or f"Entry {str(reg.id)[:8]}")


def _pref_uuid(reg: Registration, ctx: _Context) -> uuid.UUID | None:
    pref_id = preferred_partner_id_for(reg, by_id=ctx.by_id)
    return uuid.UUID(pref_id) if pref_id else None


async def _emit(
    session: AsyncSession, org_id: uuid.UUID, actor_id: uuid.UUID, run: PairingRun, action: str
) -> None:
    audit.record(
        session,
        organization_id=org_id,
        actor_id=actor_id,
        action=action,
        entity="pairing_run",
        entity_id=run.id,
        after={"status": run.status},
    )
    payload = {
        "id": str(run.id),
        "divisionId": str(run.division_id),
        "organizationId": str(org_id),
    }
    await emit_event(session, aggregate="pairing", event_type=action, payload=payload)
    await get_broadcaster().publish(org_channel(org_id), events.RT_PAIRING_UPDATED, payload)
