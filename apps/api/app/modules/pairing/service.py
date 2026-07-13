"""Smart Pairing use cases: generate a draft of skill-balanced teams, let the organizer
review / edit / lock / swap, then publish → materialize real Team + pair Participant rows.

Sport rules stay in the Sport Profile (skill→weight + policy) and the algorithm stays in
the engine (``FoldPairingEngine``). This module only orchestrates: load entrants, call the
engine, persist the draft, and on publish reuse the same Team/Participant construction the
registration module uses. Never commits — the request session owns the transaction.
"""

from __future__ import annotations

import logging
import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ConflictError, NotFoundError, ValidationError
from app.core import audit
from app.core.events import emit_event
from app.core.factory import get_broadcaster, get_sport_registry, get_team_formation_engine
from app.core.perf import timed
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
    PartnerWarning,
    PartnerWarningsResponse,
    ProposedTeamView,
)
from app.modules.registrations.entrant import (
    entrant_display_name,
    entrant_has_external_identity,
)
from app.modules.registrations.partner_resolution import (
    normalize_partner_name,
    preferred_partner_id_for,
)
from app.modules.registrations.repository import get_users_by_ids as _batch_load_users
from app.modules.squads.repository import (
    cross_squad_forbidden_registration_pairs,
    list_squads,
    squad_membership_by_registration,
)
from app.realtime.channels import org_channel

_logger = logging.getLogger("app.pairing")

DUPLICATE_PAIR_REASON = "Duplicate pair — plays twice"


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
    manual: bool = False,
) -> PairingRun:
    """(Re)generate the draft for a division.

    When *squad_id* is provided only members of that squad are eligible — this is the
    franchise/SIBL flow where intra-team pairs must be formed after the draft ceremony.
    Any locked teams in the existing draft are carried over; the old draft is discarded.

    When *manual* is True, skip the engine entirely and return an empty draft run.
    The organizer builds pairs by calling ``create_manual_pair`` on the returned run.
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
    carried_locked, carried_names, deferred_dup = _carry_locked(prior)
    if prior is not None:
        prior.status = PairingRunStatus.DISCARDED.value

    if manual:
        manual_config: dict[str, Any] = {"manual": True}
        if squad_id is not None:
            manual_config["squadId"] = str(squad_id)
        run = PairingRun(
            organization_id=org_id,
            division_id=division_id,
            status=PairingRunStatus.DRAFT.value,
            rng_seed=None,
            config=manual_config,
        )
        session.add(run)
        await session.flush()
        await _emit(session, org_id, actor_id, run, events.PAIRING_GENERATED)
        return run

    forced_member_ids = {m for group in carried_locked for m in group}
    exclude_ids = {m for members, _ in deferred_dup for m in members if m not in forced_member_ids}

    all_forced = [[str(m) for m in group] for group in forced_groups] + carried_locked
    constraints = PairingConstraints(
        forced_groups=tuple(tuple(g) for g in all_forced),
        forbidden_pairs=tuple((str(a), str(b)) for a, b in forbidden_pairs if a != b),
        prior_pairings=tuple(await repo.list_published_pairings(session, org_id, division_id)),
        avoid_repeats=True,
    )
    _validate_member_ids(all_forced, forbidden_pairs, ctx)

    entrants = _engine_entrants(ctx)
    if exclude_ids:
        entrants = [e for e in entrants if e.id not in exclude_ids]
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
    locked_sets = carried_locked_sets(all_forced) | {
        frozenset(members) for members, _ in deferred_dup
    }
    for team in plan.teams:
        member_set = frozenset(team.member_ids)
        session.add(
            ProposedTeam(
                organization_id=org_id,
                pairing_run_id=run.id,
                member_ids=list(team.member_ids),
                strength=team.strength,
                confidence=team.confidence,
                reasons=list(team.reasons),
                locked=member_set in locked_sets,
                team_name=carried_names.get(member_set),
            )
        )

    weights = {str(r.id): ctx.profile.skill_weight(r.skill_level) for r in ctx.entrants}
    for dup_members, team_name in deferred_dup:
        strength = sum((weights.get(m, Decimal(0)) for m in dup_members), Decimal(0))
        confidence = pairing_confidence(strength, target, max_dev)
        session.add(
            ProposedTeam(
                organization_id=org_id,
                pairing_run_id=run.id,
                member_ids=dup_members,
                strength=strength,
                confidence=confidence,
                reasons=[DUPLICATE_PAIR_REASON],
                locked=True,
                team_name=team_name,
            )
        )
    await session.flush()

    await _emit(session, org_id, actor_id, run, events.PAIRING_GENERATED)
    return run


async def create_manual_pair(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    run_id: uuid.UUID,
    member_ids: list[uuid.UUID],
) -> PairingRun:
    """Add a manually-created pair to a draft run.

    Each member_id must be an entrant in the run's division/squad and must not already
    belong to an un-locked team in this run (i.e. must still be in the available pool).
    Returns the updated run so the caller can rebuild the view in one round-trip.
    """
    run = await _require_draft_run(session, org_id, run_id)
    _squad_id_str: str | None = (run.config or {}).get("squadId")
    _squad_id: uuid.UUID | None = uuid.UUID(_squad_id_str) if _squad_id_str else None
    ctx = await _load_context(session, org_id, run.division_id, squad_id=_squad_id)

    # Build set of registration ids already claimed by any team in this run
    await session.refresh(run, attribute_names=["proposed_teams"])
    claimed: set[str] = set()
    for team in run.proposed_teams:
        for existing_mid in team.member_ids:
            claimed.add(str(existing_mid))

    entrant_ids = {str(r.id) for r in ctx.entrants}
    for mid in member_ids:
        if str(mid) not in entrant_ids:
            raise ValidationError(
                f"Registration {mid} is not an entrant in this run", code="invalid_member"
            )
        if str(mid) in claimed:
            raise ConflictError(
                f"Registration {mid} is already paired in this run", code="already_paired"
            )

    session.add(
        ProposedTeam(
            organization_id=org_id,
            pairing_run_id=run.id,
            member_ids=[str(m) for m in member_ids],  # stored as str UUIDs per schema
            strength=Decimal(0),
            confidence=Decimal(0),
            reasons=["Manually created"],
            locked=False,
            team_name=None,
        )
    )
    await session.flush()
    await _emit(session, org_id, actor_id, run, events.PAIRING_GENERATED)
    return run


async def delete_proposed_team(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    team_id: uuid.UUID,
) -> PairingRun:
    """Delete a manually-created proposed team from a draft run.

    Locked teams cannot be deleted — the caller must unlock first.
    Returns the updated run.
    """
    team = await _require_draft_team(session, org_id, team_id)
    if team.locked:
        raise ConflictError("Cannot delete a locked pair — unlock it first", code="team_locked")
    run = await _require_draft_run(session, org_id, team.pairing_run_id)
    await session.delete(team)
    await session.flush()
    await _emit(session, org_id, actor_id, run, events.PAIRING_GENERATED)
    return run


def _carry_locked(
    prior: PairingRun | None,
) -> tuple[list[list[str]], dict[frozenset[str], str | None], list[tuple[list[str], str | None]]]:
    """Locked teams from the prior draft.

    Normal locked teams become forced groups for the engine. Duplicate-pair teams
    (one player in two pairs) are reapplied after the engine run — they cannot be
    expressed as forced groups because the engine allows each entrant only once.
    """
    if prior is None:
        return [], {}, []
    groups: list[list[str]] = []
    names: dict[frozenset[str], str | None] = {}
    deferred_dup: list[tuple[list[str], str | None]] = []
    for team in prior.proposed_teams:
        if not team.locked:
            continue
        members = [str(m) for m in team.member_ids]
        if DUPLICATE_PAIR_REASON in list(team.reasons or []):
            deferred_dup.append((members, team.team_name))
        else:
            groups.append(members)
            names[frozenset(members)] = team.team_name
    return groups, names, deferred_dup


def carried_locked_sets(groups: list[list[str]]) -> set[frozenset[str]]:
    return {frozenset(g) for g in groups}


# ---- read ----


async def get_active_run(
    session: AsyncSession,
    org_id: uuid.UUID,
    division_id: uuid.UUID,
    squad_id: uuid.UUID | None = None,
) -> PairingRun | None:
    """Return the current run for display: draft if in flight, published if locked.

    Uses ``repo.get_current_run`` (draft-first, published-fallback) so the frontend
    footer can show "N pairs locked" after a squad run is published, without a
    separate endpoint.  Generate / swap / publish use ``repo.get_active_run``
    (draft-only) internally so they never accidentally discard a published run.
    """
    await _load_context(session, org_id, division_id, squad_id=squad_id)
    return await repo.get_current_run(session, org_id, division_id, squad_id=squad_id)


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


# ---- duplicate pair (odd squad size) ----


async def add_duplicate_pair(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    run_id: uuid.UUID,
    unpaired_id: uuid.UUID,
    duplicate_id: uuid.UUID,
) -> PairingRun:
    """Captain resolves an odd-one-out player by picking an existing player to partner
    them, allowing that player to compete in two pairs.

    Constraints enforced:
    - The run must be in DRAFT status.
    - ``unpaired_id`` must *not* be in any existing proposed team (truly unpaired).
    - ``duplicate_id`` must *already* be in an existing proposed team (plays twice).
    - The two ids must be different.
    - Both must be known entrants for this squad / division.

    The resulting ProposedTeam is locked immediately — it represents a captain's explicit
    decision and should survive any subsequent regenerate.
    """
    run = await _require_draft_run(session, org_id, run_id)
    if unpaired_id == duplicate_id:
        raise ValidationError("a player cannot be paired with themselves", code="invalid_pair")

    paired: set[str] = {str(m) for t in run.proposed_teams for m in t.member_ids}
    if str(unpaired_id) in paired:
        raise ValidationError("that player is already assigned to a pair", code="already_paired")
    if str(duplicate_id) not in paired:
        raise ValidationError(
            "the selected player is not in any existing pair — "
            "choose someone who is already paired",
            code="not_in_pair",
        )

    squad_id = _extract_squad_id(run)
    ctx = await _load_context(session, org_id, run.division_id, squad_id=squad_id)

    known = set(ctx.by_id)
    for label, mid in [
        ("unpaired player", str(unpaired_id)),
        ("duplicate player", str(duplicate_id)),
    ]:
        if mid not in known:
            raise ValidationError(
                f"the {label} is not an eligible entrant for this run", code="invalid_pair"
            )

    weights = {str(r.id): ctx.profile.skill_weight(r.skill_level) for r in ctx.entrants}
    target, max_dev = _run_bounds(run)
    strength = weights.get(str(unpaired_id), Decimal(0)) + weights.get(
        str(duplicate_id), Decimal(0)
    )
    confidence = pairing_confidence(strength, target, max_dev)

    # Append via the relationship so run.proposed_teams is back-populated immediately
    # in Python memory. If we used session.add(..., pairing_run_id=run.id) instead,
    # SQLAlchemy would not update the already-loaded collection, and build_run_view's
    # selectinload would see the stale list (N pairs instead of N+1).
    new_team = ProposedTeam(
        organization_id=org_id,
        member_ids=[str(unpaired_id), str(duplicate_id)],
        strength=strength,
        confidence=confidence,
        reasons=[DUPLICATE_PAIR_REASON],
        locked=True,
        team_name=None,
    )
    run.proposed_teams.append(new_team)
    await session.flush()
    await _emit(session, org_id, actor_id, run, events.PAIRING_EDITED)
    return run


def _extract_squad_id(run: PairingRun) -> uuid.UUID | None:
    squad_id_str = (run.config or {}).get("squadId")
    return uuid.UUID(squad_id_str) if squad_id_str else None


# ---- publish ----


async def publish(
    session: AsyncSession, *, org_id: uuid.UUID, actor_id: uuid.UUID, run_id: uuid.UUID
) -> tuple[int, int]:
    """Materialize a draft run's teams into Team + pair Participant rows, linking each
    source registration. Returns (published_teams, unpaired_count)."""
    async with timed("publish.load_run_and_context", _logger, extra={"run_id": str(run_id)}):
        run = await _require_draft_run(session, org_id, run_id, lock=True)
        # Re-scope to the squad so that franchise runs (APPROVED registrations) are found.
        squad_id = _extract_squad_id(run)
        ctx = await _load_context(session, org_id, run.division_id, squad_id=squad_id)

    team_count = len(run.proposed_teams)

    # Batch-load all submitted_by users in one query before the materialization loop.
    # Why faster: N members × 1 PK lookup per member → 1 SELECT WHERE id = ANY($1).
    # The prior code called repo.get_user() per member which, for imported external
    # players, still fired a DB round-trip even though the result was discarded.
    all_submitted_by: set[uuid.UUID] = set()
    for team in run.proposed_teams:
        for mid in team.member_ids:
            reg = ctx.by_id.get(str(mid))
            if reg is not None:
                all_submitted_by.add(reg.submitted_by)
    async with timed(
        "publish.batch_load_users", _logger, extra={"user_count": len(all_submitted_by)}
    ):
        user_cache = await _batch_load_users(session, all_submitted_by)

    paired_ids: set[str] = set()
    published = 0
    async with timed("publish.materialize_all_teams", _logger, extra={"team_count": team_count}):
        for team in run.proposed_teams:
            members = [str(m) for m in team.member_ids]
            regs = [ctx.by_id.get(m) for m in members]
            if any(r is None for r in regs):
                raise ConflictError(
                    "a proposed team references an entrant that is no longer eligible; regenerate",
                    code="stale_pairing",
                )
            _materialize_team(
                session, org_id, ctx, team, [r for r in regs if r is not None], user_cache
            )
            paired_ids.update(members)
            published += 1

    run.status = PairingRunStatus.PUBLISHED.value
    # Single flush covers all Team + RosterEntry + Participant INSERTs + reg status UPDATEs.
    # Why faster: eliminated 3 flushes × N teams (the original per-team flushes existed
    # because flush 1 was needed for team_row.id as FK, but uuid7 default is applied at
    # Python object construction time, so team_row.id is available without a flush).
    async with timed("publish.single_flush", _logger, extra={"team_count": team_count}):
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


def _materialize_team(
    session: AsyncSession,
    org_id: uuid.UUID,
    ctx: _Context,
    team: ProposedTeam,
    regs: list[Registration],
    user_cache: dict[uuid.UUID, Any],
) -> None:
    """Add Team + RosterEntry + Participant rows to the session in memory.

    No session.flush() calls — callers must flush once after all teams are materialized.

    Why no flush needed for team_row.id: UUIDPrimaryKeyMixin uses `default=uuid7`,
    which is a Python-side callable applied at object construction time. team_row.id is
    set by SQLAlchemy immediately when Team(...) is called, before any INSERT happens.
    This lets RosterEntry(team_id=team_row.id) be created without needing the DB to
    assign the PK first.
    """
    member_names = [_entrant_name(reg) for reg in regs]
    name = team.team_name or (
        " / ".join(member_names) if member_names else f"Team {str(team.id)[:8]}"
    )
    captain = regs[0].submitted_by if regs else None
    team_row = Team(organization_id=org_id, name=name, captain_user_id=captain)
    session.add(team_row)
    for reg in regs:
        user = user_cache.get(reg.submitted_by)
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
    # A pair Participant is owned by TWO registrations, so we can't use the 1:1
    # registrations.participant_id link (unique) — the roster carries the members. We
    # just move the source registrations to `approved`, which drops them from the pool.
    for reg in regs:
        reg.status = RegistrationStatus.APPROVED.value


async def get_partner_warnings(
    session: AsyncSession, *, org_id: uuid.UUID, division_id: uuid.UUID
) -> PartnerWarningsResponse:
    """Scan approved registrations for unresolvable partner name preferences."""
    ctx = await _load_context(session, org_id, division_id)
    warnings: list[PartnerWarning] = []

    for reg in ctx.entrants:
        form = reg.form_response or {}
        partner_name = form.get("preferredPartnerName")
        if not partner_name:
            continue
        # Already resolved — no warning needed.
        if form.get("preferredPartnerRegistrationId") and preferred_partner_id_for(
            reg, by_id=ctx.by_id
        ):
            continue

        player_name = str(form.get("name") or reg.id)
        key = normalize_partner_name(str(partner_name))
        matches = [
            r
            for r in ctx.entrants
            if r.id != reg.id
            and normalize_partner_name(str((r.form_response or {}).get("name", ""))) == key
        ]
        reason = "ambiguous" if len(matches) > 1 else "not_found"
        warnings.append(
            PartnerWarning(
                registration_id=reg.id,
                player_name=player_name,
                requested_partner_name=str(partner_name),
                reason=reason,
            )
        )

    return PartnerWarningsResponse(warnings=warnings, total=len(warnings))


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
    session: AsyncSession, org_id: uuid.UUID, run_id: uuid.UUID, *, lock: bool = False
) -> PairingRun:
    run = await repo.get_run(session, org_id, run_id, for_update=lock)
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
    # Same-session mutations (e.g. add_duplicate_pair) may not appear on a cached
    # proposed_teams collection when expire_on_commit=False.
    await session.refresh(run, attribute_names=["proposed_teams"])
    # Extract squad scope so the entrant list, unpaired count, and summary all reflect
    # only the squad's members — not the whole division.
    squad_id = _extract_squad_id(run)
    ctx = await _load_context(session, org_id, run.division_id, squad_id=squad_id)

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
