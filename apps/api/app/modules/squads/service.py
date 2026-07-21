"""Franchise squad use cases — group registrations into balanced teams before pairing."""

from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ConflictError, NotFoundError, ValidationError
from app.cache import keys as cache_keys
from app.core import audit
from app.core.events import emit_event
from app.core.factory import get_cache, get_sport_registry
from app.db.models import Registration, Squad, SquadMember, Tournament
from app.engine.squad_distribution import snake_distribute
from app.modules.registrations.entrant import entrant_display_name
from app.modules.squads import events
from app.modules.squads import repository as repo
from app.modules.squads.schemas import (
    AutoDistributeResponse,
    SquadMemberView,
    SquadSummary,
    SquadView,
    TournamentSquadsView,
    UnassignedRegistrationView,
)

_AGGREGATE = "squad"


async def _emit(session: AsyncSession, event_type: str, payload: dict) -> None:
    await emit_event(session, aggregate=_AGGREGATE, event_type=event_type, payload=payload)


async def _evict_public_roster(tournament_id: uuid.UUID) -> None:
    """A team's name is stamped on every public surface that mentions its players —
    the roster, the court queue, the schedule — so a rename or a roster move has to
    drop the whole tournament's cached views, not just one of them. Otherwise the
    microsite serves the old name until each TTL happens to lapse."""
    await get_cache().delete_many(list(cache_keys.public_tournament_keys(tournament_id).values()))


async def get_board(
    session: AsyncSession, org_id: uuid.UUID, tournament_id: uuid.UUID
) -> TournamentSquadsView:
    tournament = await repo.get_tournament(session, org_id, tournament_id)
    if tournament is None:
        raise NotFoundError("Tournament not found")
    return await _build_board(session, org_id, tournament_id, tournament=tournament)


async def create_squad(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    tournament_id: uuid.UUID,
    name: str,
) -> SquadView:
    tournament = await repo.get_tournament(session, org_id, tournament_id)
    if tournament is None:
        raise NotFoundError("Tournament not found")

    squads = await repo.list_squads(session, org_id, tournament_id)
    squad = Squad(
        organization_id=org_id,
        tournament_id=tournament_id,
        name=name.strip(),
        sort_order=len(squads),
    )
    session.add(squad)
    await session.flush()

    audit.record(
        session,
        organization_id=org_id,
        actor_id=actor_id,
        action="squad.create",
        entity="squad",
        entity_id=squad.id,
        after={"tournament_id": str(tournament_id), "name": squad.name},
    )
    await _emit(
        session,
        events.SQUAD_CREATED,
        {"squad_id": str(squad.id), "tournament_id": str(tournament_id)},
    )

    board = await _build_board(session, org_id, tournament_id, tournament=tournament)
    return _find_squad_view(board, squad.id)


async def update_squad(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    squad_id: uuid.UUID,
    name: str | None,
    captain_registration_id: uuid.UUID | None,
    clear_captain: bool,
) -> SquadView:
    squad = await repo.get_squad(session, org_id, squad_id)
    if squad is None:
        raise NotFoundError("Team not found")

    if name is not None:
        squad.name = name.strip()
        await repo.rename_squad_participants(session, org_id, squad.id, squad.name)
    if clear_captain:
        squad.captain_registration_id = None
    elif captain_registration_id is not None:
        member_ids = {m.registration_id for m in squad.members}
        if captain_registration_id not in member_ids:
            raise ValidationError("Captain must be assigned to this team")
        squad.captain_registration_id = captain_registration_id

    audit.record(
        session,
        organization_id=org_id,
        actor_id=actor_id,
        action="squad.update",
        entity="squad",
        entity_id=squad.id,
        after={"name": squad.name},
    )
    await _emit(session, events.SQUAD_UPDATED, {"squad_id": str(squad.id)})
    await _evict_public_roster(squad.tournament_id)

    board = await _build_board(session, org_id, squad.tournament_id)
    return _find_squad_view(board, squad.id)


async def delete_squad(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    squad_id: uuid.UUID,
) -> None:
    squad = await repo.get_squad(session, org_id, squad_id)
    if squad is None:
        raise NotFoundError("Team not found")
    if await repo.has_published_pairing_run_for_squad(session, org_id, squad_id):
        raise ConflictError(
            "This team has published pairs. Discard the pairs before deleting the team."
        )
    tournament_id = squad.tournament_id
    await session.delete(squad)

    audit.record(
        session,
        organization_id=org_id,
        actor_id=actor_id,
        action="squad.delete",
        entity="squad",
        entity_id=squad_id,
        before={"tournament_id": str(tournament_id)},
    )
    await _emit(session, events.SQUAD_DELETED, {"squad_id": str(squad_id)})
    await _evict_public_roster(tournament_id)


async def assign_member(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    squad_id: uuid.UUID,
    registration_id: uuid.UUID,
) -> SquadView:
    squad = await repo.get_squad(session, org_id, squad_id)
    if squad is None:
        raise NotFoundError("Team not found")

    await _eligible_registration(session, org_id, squad.tournament_id, registration_id)
    existing = await repo.get_member_by_registration(session, org_id, registration_id)
    if existing is not None:
        if existing.squad_id == squad_id:
            board = await _build_board(session, org_id, squad.tournament_id)
            return _find_squad_view(board, squad_id)
        await session.delete(existing)

    session.add(
        SquadMember(
            organization_id=org_id,
            squad_id=squad_id,
            registration_id=registration_id,
        )
    )
    if squad.captain_registration_id == registration_id:
        pass
    await session.flush()

    audit.record(
        session,
        organization_id=org_id,
        actor_id=actor_id,
        action="squad.assign",
        entity="squad",
        entity_id=squad_id,
        after={"registration_id": str(registration_id)},
    )
    await _emit(
        session,
        events.SQUAD_MEMBER_ASSIGNED,
        {"squad_id": str(squad_id), "registration_id": str(registration_id)},
    )
    await _evict_public_roster(squad.tournament_id)

    board = await _build_board(session, org_id, squad.tournament_id)
    return _find_squad_view(board, squad_id)


async def remove_member(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    squad_id: uuid.UUID,
    registration_id: uuid.UUID,
) -> None:
    squad = await repo.get_squad(session, org_id, squad_id)
    if squad is None:
        raise NotFoundError("Team not found")

    member = await repo.get_member_by_registration(session, org_id, registration_id)
    if member is None or member.squad_id != squad_id:
        raise NotFoundError("Member not on this team")

    if squad.captain_registration_id == registration_id:
        squad.captain_registration_id = None

    await session.delete(member)
    await _emit(
        session,
        events.SQUAD_MEMBER_REMOVED,
        {"squad_id": str(squad_id), "registration_id": str(registration_id)},
    )
    await _evict_public_roster(squad.tournament_id)


async def swap_members(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    tournament_id: uuid.UUID,
    squad_a_id: uuid.UUID,
    registration_a_id: uuid.UUID,
    squad_b_id: uuid.UUID,
    registration_b_id: uuid.UUID,
) -> TournamentSquadsView:
    """Atomically trade one member between two squads.

    Both members move within a single transaction, so a failure part-way can never
    leave a player unassigned (the four-call client-side sequence it replaces could).
    Captains are not swappable — the roster keeps its designated captain.
    """
    if squad_a_id == squad_b_id:
        raise ValidationError("Cannot swap within the same team")
    if registration_a_id == registration_b_id:
        raise ValidationError("Cannot swap a player with themselves")

    squad_a = await repo.get_squad(session, org_id, squad_a_id)
    squad_b = await repo.get_squad(session, org_id, squad_b_id)
    if squad_a is None or squad_b is None:
        raise NotFoundError("Team not found")
    if squad_a.tournament_id != tournament_id or squad_b.tournament_id != tournament_id:
        raise ValidationError("Teams do not belong to this tournament")

    member_a = await repo.get_member_by_registration(session, org_id, registration_a_id)
    member_b = await repo.get_member_by_registration(session, org_id, registration_b_id)
    if member_a is None or member_a.squad_id != squad_a_id:
        raise NotFoundError("Member not on this team")
    if member_b is None or member_b.squad_id != squad_b_id:
        raise NotFoundError("Member not on this team")

    if squad_a.captain_registration_id == registration_a_id:
        raise ValidationError("Cannot swap a team captain")
    if squad_b.captain_registration_id == registration_b_id:
        raise ValidationError("Cannot swap a team captain")

    # Single-transaction move: reassign both rows, no delete/insert window.
    member_a.squad_id = squad_b_id
    member_b.squad_id = squad_a_id
    await session.flush()

    audit.record(
        session,
        organization_id=org_id,
        actor_id=actor_id,
        action="squad.swap",
        entity="squad",
        entity_id=squad_a_id,
        after={
            "squad_a_id": str(squad_a_id),
            "registration_a_id": str(registration_a_id),
            "squad_b_id": str(squad_b_id),
            "registration_b_id": str(registration_b_id),
        },
    )
    await _emit(
        session,
        events.SQUAD_MEMBERS_SWAPPED,
        {
            "squad_a_id": str(squad_a_id),
            "registration_a_id": str(registration_a_id),
            "squad_b_id": str(squad_b_id),
            "registration_b_id": str(registration_b_id),
        },
    )

    # Mutating member.squad_id directly does not update the already-loaded
    # Squad.members collections, so expire before rebuilding or the response
    # would echo the pre-swap rosters.
    session.expire_all()

    await _evict_public_roster(tournament_id)
    return await _build_board(session, org_id, tournament_id)


async def auto_distribute(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    tournament_id: uuid.UUID,
    team_count: int,
    division_id: uuid.UUID | None,
    replace_existing: bool,
) -> AutoDistributeResponse:
    tournament = await repo.get_tournament(session, org_id, tournament_id)
    if tournament is None:
        raise NotFoundError("Tournament not found")

    if division_id is not None:
        division = await repo.get_division(session, org_id, division_id)
        if division is None or division.tournament_id != tournament_id:
            raise NotFoundError("Division not found")

    registrations = list(
        await repo.list_eligible_registrations(
            session, org_id, tournament_id, division_id=division_id
        )
    )
    if len(registrations) < team_count:
        raise ValidationError(
            f"Need at least {team_count} eligible registrations to form {team_count} teams"
        )

    profile_row = await repo.get_sport_profile(session, tournament.sport_profile_id)
    profile = get_sport_registry().get(profile_row.key) if profile_row else None

    squads = list(await repo.list_squads(session, org_id, tournament_id))
    if replace_existing or len(squads) != team_count:
        if squads:
            await repo.delete_tournament_squads(session, org_id, tournament_id)
        squads = []
        for i in range(team_count):
            squad = Squad(
                organization_id=org_id,
                tournament_id=tournament_id,
                name=f"Team {i + 1}",
                sort_order=i,
            )
            session.add(squad)
            squads.append(squad)
        await session.flush()

    # Always replace assignments on auto-distribute — full rebalance.
    await repo.clear_tournament_squad_members(session, org_id, tournament_id)
    for squad in squads:
        squad.captain_registration_id = None
    await session.flush()

    if profile is None:
        raise ValidationError("Sport profile not configured for this tournament")
    weights = {str(r.id): profile.skill_weight(r.skill_level) for r in registrations}
    ordered = sorted(
        (str(r.id) for r in registrations),
        key=lambda rid: (-weights[rid], rid),
    )
    buckets = snake_distribute(ordered, team_count)

    for squad, member_ids in zip(squads, buckets, strict=True):
        for reg_id in member_ids:
            session.add(
                SquadMember(
                    organization_id=org_id,
                    squad_id=squad.id,
                    registration_id=uuid.UUID(reg_id),
                )
            )

    await session.flush()

    audit.record(
        session,
        organization_id=org_id,
        actor_id=actor_id,
        action="squad.auto_distribute",
        entity="tournament",
        entity_id=tournament_id,
        after={"team_count": team_count, "assigned": len(registrations)},
    )
    await _emit(
        session,
        events.SQUAD_AUTO_DISTRIBUTED,
        {"tournament_id": str(tournament_id), "team_count": team_count},
    )
    await _evict_public_roster(tournament_id)

    board = await _build_board(session, org_id, tournament_id, tournament=tournament)
    return AutoDistributeResponse(squads=board.squads, summary=board.summary)


async def _eligible_registration(
    session: AsyncSession,
    org_id: uuid.UUID,
    tournament_id: uuid.UUID,
    registration_id: uuid.UUID,
) -> Registration:
    registration = await repo.get_registration(session, org_id, registration_id)
    if registration is None:
        raise NotFoundError("Registration not found")

    division = await repo.get_division(session, org_id, registration.division_id)
    if division is None or division.tournament_id != tournament_id:
        raise ValidationError("Registration does not belong to this tournament")

    from app.db.enums import RegistrationStatus

    if registration.status not in {
        RegistrationStatus.SUBMITTED.value,
        RegistrationStatus.WAITLISTED.value,
        RegistrationStatus.APPROVED.value,
    }:
        raise ConflictError("Registration is not eligible for team assignment")

    return registration


async def _build_board(
    session: AsyncSession,
    org_id: uuid.UUID,
    tournament_id: uuid.UUID,
    tournament: Tournament | None = None,
) -> TournamentSquadsView:
    if tournament is None:
        tournament = await repo.get_tournament(session, org_id, tournament_id)
    if tournament is None:
        raise NotFoundError("Tournament not found")

    divisions = {d.id: d for d in await repo.list_divisions(session, org_id, tournament_id)}
    squads = await repo.list_squads(session, org_id, tournament_id)
    eligible = list(await repo.list_eligible_registrations(session, org_id, tournament_id))

    profile_row = await repo.get_sport_profile(session, tournament.sport_profile_id)
    profile = get_sport_registry().get(profile_row.key) if profile_row else None
    submitter_ids = {r.submitted_by for r in eligible}
    submitter_names = await repo.load_submitter_names(session, submitter_ids)

    assigned_ids: set[uuid.UUID] = set()
    squad_views: list[SquadView] = []

    for squad in squads:
        members: list[SquadMemberView] = []
        total = Decimal(0)
        for member in squad.members:
            reg = member.registration
            assigned_ids.add(reg.id)
            weight = profile.skill_weight(reg.skill_level) if profile else Decimal("2")
            total += weight
            div = divisions.get(reg.division_id)
            members.append(
                SquadMemberView(
                    registration_id=reg.id,
                    display_name=entrant_display_name(
                        reg, account_name=submitter_names.get(reg.submitted_by)
                    ),
                    skill_level=reg.skill_level,
                    division_id=reg.division_id,
                    division_name=div.name if div else "Division",
                    skill_weight=float(weight),
                )
            )
        members.sort(key=lambda m: (-m.skill_weight, m.display_name.lower()))
        squad_views.append(
            SquadView(
                id=squad.id,
                name=squad.name,
                sort_order=squad.sort_order,
                captain_registration_id=squad.captain_registration_id,
                member_count=len(members),
                total_skill_weight=float(total),
                members=members,
            )
        )

    unassigned: list[UnassignedRegistrationView] = []
    for reg in eligible:
        if reg.id in assigned_ids:
            continue
        weight = profile.skill_weight(reg.skill_level) if profile else Decimal("2")
        div = divisions.get(reg.division_id)
        unassigned.append(
            UnassignedRegistrationView(
                registration_id=reg.id,
                display_name=entrant_display_name(
                    reg, account_name=submitter_names.get(reg.submitted_by)
                ),
                skill_level=reg.skill_level,
                division_id=reg.division_id,
                division_name=div.name if div else "Division",
                skill_weight=float(weight),
                status=reg.status,
            )
        )
    unassigned.sort(key=lambda m: (-m.skill_weight, m.display_name.lower()))

    summary = SquadSummary(
        squad_count=len(squad_views),
        assigned=len(assigned_ids),
        unassigned=len(unassigned),
        eligible=len(eligible),
    )

    return TournamentSquadsView(
        tournament_id=tournament_id,
        squads=squad_views,
        unassigned=unassigned,
        summary=summary,
    )


def _find_squad_view(board: TournamentSquadsView, squad_id: uuid.UUID) -> SquadView:
    for squad in board.squads:
        if squad.id == squad_id:
            return squad
    raise NotFoundError("Team not found")
