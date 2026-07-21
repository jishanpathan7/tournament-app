"""Franchise team-vs-team ties — squad draw, leg expansion, rollup."""

from __future__ import annotations

import uuid
from collections import defaultdict
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ConflictError, NotFoundError, ValidationError
from app.core import audit
from app.core.events import emit_event
from app.db.enums import ContestKind, MatchOutcome, MatchStatus, ParticipantKind, ParticipantStatus
from app.db.models import Group, Match, MatchParticipant, Participant, Round, Stage
from app.engine import FormatKey, GenerateRequest, ParticipantRef, ParticipantSideRef
from app.engine.formats.round_robin import RoundRobinFormat
from app.engine.formats.single_elimination import SingleEliminationFormat
from app.engine.source_refs import ByeRef, SeedRef, WinnerOfRef
from app.engine.tie_rollup import LegOutcome, rollup_legs
from app.modules.franchise_ties import events
from app.modules.franchise_ties import repository as repo
from app.modules.franchise_ties.schemas import (
    FranchiseDrawResponse,
    FranchiseDrawSummary,
    FranchiseTiesBoardView,
    FranchiseTieView,
    SquadStandingRow,
    SquadStandingsView,
    TieLegView,
)
from app.modules.pairing import repository as pairing_repo
from app.modules.squads import repository as squad_repo
from app.modules.tournaments import repository as tour_repo
from app.modules.tournaments import service as tour_service

_TERMINAL = {
    MatchStatus.COMPLETED.value,
    MatchStatus.WALKOVER.value,
    MatchStatus.NO_SHOW.value,
}


def _tie_side_participants(tie: Match) -> list[MatchParticipant]:
    """Return match participants in home/away order from source_refs."""
    refs = tie.source_refs or {}
    side_ids = [s.get("participant") for s in refs.get("sides") or [] if s.get("participant")]
    by_pid = {str(mp.participant_id): mp for mp in tie.participants}
    ordered = [by_pid[pid] for pid in side_ids if pid in by_pid]
    if len(ordered) == len(tie.participants):
        return ordered
    return sorted(tie.participants, key=lambda mp: str(mp.participant_id))


async def materialize_squad_participants(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    division_id: uuid.UUID,
    tournament_id: uuid.UUID,
) -> list[Participant]:
    """Ensure each franchise squad has a squad-kind Participant in the division."""
    squads = await squad_repo.list_squads(session, org_id, tournament_id)
    if len(squads) < 2:
        raise ValidationError(
            "at least 2 franchise teams are required for a tie draw",
            code="too_few_squads",
        )
    out: list[Participant] = []
    for idx, squad in enumerate(squads):
        existing = await repo.get_squad_participant_by_squad(session, org_id, division_id, squad.id)
        if existing is not None:
            # The name was copied from the team when this row was first created, so a
            # team renamed since then would otherwise keep competing under its old name.
            if existing.display_name != squad.name:
                existing.display_name = squad.name
            out.append(existing)
            continue
        participant = Participant(
            organization_id=org_id,
            division_id=division_id,
            kind=ParticipantKind.SQUAD.value,
            squad_id=squad.id,
            display_name=squad.name,
            status=ParticipantStatus.APPROVED.value,
            seed=idx + 1,
        )
        session.add(participant)
        await session.flush()
        out.append(participant)
    return out


async def squad_pair_map(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    division_id: uuid.UUID,
    tournament_id: uuid.UUID,
) -> dict[uuid.UUID, list[Participant]]:
    """Map squad_id → ordered pair participants (from published pairing runs).

    Supports both division-wide pairing (single run) and squad-scoped pairing
    (one run per squad, produced by Gap A squad-scoped pairing engine).
    """
    runs = await pairing_repo.list_all_published_runs(session, org_id, division_id)
    if not runs:
        raise ValidationError(
            "publish doubles pairings before generating franchise ties",
            code="pairing_not_published",
        )
    membership = await squad_repo.squad_membership_by_registration(session, org_id, tournament_id)

    # Aggregate proposed_teams across all runs, preserving global creation order so
    # the zip against list_approved_pair_participants (also ordered by created_at) holds.
    all_proposed = sorted(
        (t for run in runs for t in run.proposed_teams),
        key=lambda t: (t.created_at, str(t.id)),
    )
    pairs = list(await repo.list_approved_pair_participants(session, org_id, division_id))
    if len(all_proposed) != len(pairs):
        raise ValidationError(
            "published pairing count does not match pair participants — regenerate pairing",
            code="pairing_mismatch",
        )

    squad_pairs: dict[uuid.UUID, list[Participant]] = defaultdict(list)
    for pt, pair in zip(all_proposed, pairs, strict=True):
        reg_ids = [uuid.UUID(str(r)) for r in (pt.member_ids or [])]
        squad_ids = {membership[r] for r in reg_ids if r in membership}
        if len(squad_ids) != 1:
            raise ValidationError(
                "each doubles pair must belong to exactly one franchise team",
                code="pair_squad_ambiguous",
            )
        squad_pairs[next(iter(squad_ids))].append(pair)
    return dict(squad_pairs)


def _default_games_per_tie(squad_pairs: dict[uuid.UUID, list[Participant]]) -> int:
    counts = [len(v) for v in squad_pairs.values()]
    if not counts:
        return 1
    return max(1, min(counts))


async def generate_franchise_draw(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    stage_id: uuid.UUID,
    games_per_tie: int | None = None,
) -> FranchiseDrawResponse:
    """Round-robin squad ties + doubles legs for a stage."""
    stage = await repo.get_stage(session, org_id, stage_id)
    if stage is None:
        raise NotFoundError("Stage not found")
    if await tour_repo.stage_match_count(session, org_id, stage.id) > 0:
        raise ConflictError("this stage has already been drawn")

    division = await tour_repo.get_division(session, org_id, stage.division_id)
    if division is None:
        raise NotFoundError("Division not found")
    tournament = await tour_repo.get_tournament(session, org_id, division.tournament_id)
    if tournament is None:
        raise NotFoundError("Tournament not found")

    squad_participants = await materialize_squad_participants(
        session,
        org_id=org_id,
        division_id=division.id,
        tournament_id=tournament.id,
    )
    pairs_by_squad = await squad_pair_map(
        session,
        org_id=org_id,
        division_id=division.id,
        tournament_id=tournament.id,
    )
    per_tie = games_per_tie or _default_games_per_tie(pairs_by_squad)

    refs = tuple(
        ParticipantRef(id=str(p.id), seed=p.seed or i + 1) for i, p in enumerate(squad_participants)
    )
    fmt = RoundRobinFormat()
    plan = fmt.generate(
        GenerateRequest(
            format=FormatKey.ROUND_ROBIN,
            participants=refs,
            config=stage.config or {},
            rng_seed=None,
        )
    )

    # Mark stage as franchise mode for standings filtering.
    cfg = dict(stage.config or {})
    cfg["franchiseMode"] = True
    cfg["franchiseFormat"] = "round_robin"
    cfg["gamesPerTie"] = per_tie
    stage.config = cfg

    summary = await _persist_franchise_structure(
        session,
        org_id=org_id,
        tournament_id=tournament.id,
        stage=stage,
        plan=plan,
        squad_participants=squad_participants,
        pairs_by_squad=pairs_by_squad,
        games_per_tie=per_tie,
    )

    audit.record(
        session,
        organization_id=org_id,
        actor_id=actor_id,
        action=events.GENERATED,
        entity="stage",
        entity_id=stage.id,
        after=summary,
    )
    await emit_event(
        session,
        aggregate=events.AGGREGATE,
        event_type=events.GENERATED,
        payload={"stageId": str(stage.id), "organizationId": str(org_id)},
    )

    return FranchiseDrawResponse(
        stage_id=stage.id,
        summary=FranchiseDrawSummary(
            ties=summary["ties"],
            legs=summary["legs"],
            games_per_tie=per_tie,
            squad_count=len(squad_participants),
        ),
    )


async def generate_franchise_knockout_draw(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    stage_id: uuid.UUID,
    source_stage_id: uuid.UUID | None = None,
    advance_count: int | None = None,
    games_per_tie: int | None = None,
) -> FranchiseDrawResponse:
    """Single-elimination squad ties — legs expand when both squads are known."""
    stage = await repo.get_stage(session, org_id, stage_id)
    if stage is None:
        raise NotFoundError("Stage not found")
    if await tour_repo.stage_match_count(session, org_id, stage.id) > 0:
        raise ConflictError("this stage has already been drawn")

    division = await tour_repo.get_division(session, org_id, stage.division_id)
    if division is None:
        raise NotFoundError("Division not found")
    tournament = await tour_repo.get_tournament(session, org_id, division.tournament_id)
    if tournament is None:
        raise NotFoundError("Tournament not found")

    if source_stage_id is not None:
        squad_participants = await repo.squad_participants_by_standings(
            session, org_id, source_stage_id, advance_count=advance_count
        )
        if len(squad_participants) < 2:
            raise ValidationError(
                "source stage standings need at least 2 squads for a knockout draw",
                code="too_few_squads",
            )
    else:
        squad_participants = list(await repo.list_squad_participants(session, org_id, division.id))
        if advance_count is not None:
            squad_participants = squad_participants[:advance_count]
        if len(squad_participants) < 2:
            squad_participants = await materialize_squad_participants(
                session,
                org_id=org_id,
                division_id=division.id,
                tournament_id=tournament.id,
            )
            if advance_count is not None:
                squad_participants = squad_participants[:advance_count]

    pairs_by_squad = await squad_pair_map(
        session,
        org_id=org_id,
        division_id=division.id,
        tournament_id=tournament.id,
    )
    per_tie = games_per_tie or _default_games_per_tie(pairs_by_squad)

    refs = tuple(
        ParticipantRef(id=str(p.id), seed=p.seed or i + 1) for i, p in enumerate(squad_participants)
    )
    fmt = SingleEliminationFormat()
    plan = fmt.generate(
        GenerateRequest(
            format=FormatKey.SINGLE_ELIM,
            participants=refs,
            config=stage.config or {},
            rng_seed=None,
        )
    )

    cfg = dict(stage.config or {})
    cfg["franchiseMode"] = True
    cfg["franchiseFormat"] = "knockout"
    cfg["gamesPerTie"] = per_tie
    if source_stage_id is not None:
        cfg["sourceStageId"] = str(source_stage_id)
    stage.config = cfg

    summary = await _persist_franchise_knockout(
        session,
        org_id=org_id,
        tournament_id=tournament.id,
        stage=stage,
        plan=plan,
        squad_participants=squad_participants,
        pairs_by_squad=pairs_by_squad,
        games_per_tie=per_tie,
    )
    await advance_franchise_knockout(session, org_id=org_id, stage_id=stage.id)

    audit.record(
        session,
        organization_id=org_id,
        actor_id=actor_id,
        action=events.GENERATED,
        entity="stage",
        entity_id=stage.id,
        after={**summary, "format": "knockout"},
    )
    await emit_event(
        session,
        aggregate=events.AGGREGATE,
        event_type=events.GENERATED,
        payload={"stageId": str(stage.id), "organizationId": str(org_id), "format": "knockout"},
    )

    return FranchiseDrawResponse(
        stage_id=stage.id,
        summary=FranchiseDrawSummary(
            ties=summary["ties"],
            legs=summary["legs"],
            games_per_tie=per_tie,
            squad_count=len(squad_participants),
        ),
    )


async def advance_franchise_knockout(
    session: AsyncSession, *, org_id: uuid.UUID, stage_id: uuid.UUID
) -> dict[str, int]:
    """Resolve winner_of ties and expand legs for newly playable franchise KO ties."""
    stage = await repo.get_stage(session, org_id, stage_id)
    if stage is None:
        return {"expanded": 0}
    cfg = stage.config or {}
    if not cfg.get("franchiseMode") or cfg.get("franchiseFormat") != "knockout":
        return {"expanded": 0}

    await tour_service.resolve_bracket(session, org_id, stage)

    division = await tour_repo.get_division(session, org_id, stage.division_id)
    if division is None:
        return {"expanded": 0}
    tournament = await tour_repo.get_tournament(session, org_id, division.tournament_id)
    if tournament is None:
        return {"expanded": 0}

    pairs_by_squad = await squad_pair_map(
        session,
        org_id=org_id,
        division_id=division.id,
        tournament_id=tournament.id,
    )
    games_per_tie = int(cfg.get("gamesPerTie") or 1)
    expanded = 0
    for tie in await repo.list_tie_matches(session, org_id, stage_id):
        if tie.status not in (MatchStatus.SCHEDULED.value, MatchStatus.LIVE.value):
            continue
        if len(tie.participants) < 2:
            continue
        expanded += await expand_tie_legs(
            session,
            org_id=org_id,
            tournament_id=tournament.id,
            stage=stage,
            tie=tie,
            pairs_by_squad=pairs_by_squad,
            games_per_tie=games_per_tie,
        )
    await session.flush()
    return {"expanded": expanded}


async def expand_tie_legs(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    tournament_id: uuid.UUID,
    stage: Stage,
    tie: Match,
    pairs_by_squad: dict[uuid.UUID, list[Participant]],
    games_per_tie: int,
) -> int:
    """Materialize doubles legs for a tie with both squads known. Idempotent."""
    if await repo.tie_has_legs(session, org_id, tie.id):
        return 0

    loaded = await repo.get_match_with_participants(session, org_id, tie.id)
    if loaded is None:
        return 0
    tie = loaded

    ordered = _tie_side_participants(tie)
    if len(ordered) < 2:
        return 0

    squad_by_participant: dict[str, uuid.UUID] = {}
    for mp in ordered:
        part = await session.get(Participant, mp.participant_id)
        if part is None or part.squad_id is None:
            return 0
        squad_by_participant[str(mp.participant_id)] = part.squad_id

    home_id = str(ordered[0].participant_id)
    away_id = str(ordered[1].participant_id)
    home_squad = squad_by_participant[home_id]
    away_squad = squad_by_participant[away_id]
    home_pairs = pairs_by_squad.get(home_squad, [])
    away_pairs = pairs_by_squad.get(away_squad, [])
    if not home_pairs or not away_pairs:
        raise ValidationError(
            "each squad needs at least one doubles pair for franchise ties",
            code="missing_squad_pairs",
        )

    payload = tie.result_payload or {}
    tie.result_payload = {
        **payload,
        "gamesPerTie": games_per_tie,
        "legWins": payload.get("legWins") or {},
    }

    leg_count = 0
    for leg_index in range(games_per_tie):
        home_pair = home_pairs[leg_index % len(home_pairs)]
        away_pair = away_pairs[leg_index % len(away_pairs)]
        leg = Match(
            organization_id=org_id,
            tournament_id=tournament_id,
            stage_id=stage.id,
            parent_match_id=tie.id,
            round_id=tie.round_id,
            group_id=tie.group_id,
            status=MatchStatus.SCHEDULED.value,
            contest_kind=ContestKind.LEG.value,
            result_payload={},
            source_refs={
                "sides": [
                    {"participant": str(home_pair.id)},
                    {"participant": str(away_pair.id)},
                ],
                "legIndex": leg_index,
                "homeSquadParticipantId": home_id,
                "awaySquadParticipantId": away_id,
            },
        )
        session.add(leg)
        await session.flush()
        leg_count += 1
        for pair_part in (home_pair, away_pair):
            session.add(
                MatchParticipant(
                    organization_id=org_id,
                    match_id=leg.id,
                    participant_id=pair_part.id,
                )
            )
    await session.flush()
    return leg_count


async def _persist_franchise_structure(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    tournament_id: uuid.UUID,
    stage: Stage,
    plan: Any,
    squad_participants: list[Participant],
    pairs_by_squad: dict[uuid.UUID, list[Participant]],
    games_per_tie: int,
) -> dict[str, int]:
    squad_id_by_participant = {str(p.id): p.squad_id for p in squad_participants if p.squad_id}

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

    tie_count = leg_count = 0
    for match_plan in plan.matches:
        home_id = away_id = None
        for side in match_plan.source_refs.sides:
            if isinstance(side, ParticipantSideRef):
                if home_id is None:
                    home_id = side.participant_id
                else:
                    away_id = side.participant_id
        if home_id is None or away_id is None:
            continue

        home_squad = squad_id_by_participant.get(home_id)
        away_squad = squad_id_by_participant.get(away_id)
        if home_squad is None or away_squad is None:
            continue

        tie = Match(
            organization_id=org_id,
            tournament_id=tournament_id,
            stage_id=stage.id,
            round_id=round_id_by_key.get(match_plan.round_key) if match_plan.round_key else None,
            group_id=group_id_by_key.get(match_plan.group_key) if match_plan.group_key else None,
            status=MatchStatus.SCHEDULED.value,
            contest_kind=ContestKind.TIE.value,
            result_payload={"gamesPerTie": games_per_tie, "legWins": {}},
            source_refs={
                "sides": [{"participant": home_id}, {"participant": away_id}],
                "franchiseTie": True,
            },
        )
        session.add(tie)
        await session.flush()
        tie_count += 1

        for part_id in (home_id, away_id):
            session.add(
                MatchParticipant(
                    organization_id=org_id,
                    match_id=tie.id,
                    participant_id=uuid.UUID(part_id),
                )
            )

        leg_count += await expand_tie_legs(
            session,
            org_id=org_id,
            tournament_id=tournament_id,
            stage=stage,
            tie=tie,
            pairs_by_squad=pairs_by_squad,
            games_per_tie=games_per_tie,
        )

    await session.flush()
    return {"ties": tie_count, "legs": leg_count}


async def _persist_franchise_knockout(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    tournament_id: uuid.UUID,
    stage: Stage,
    plan: Any,
    squad_participants: list[Participant],
    pairs_by_squad: dict[uuid.UUID, list[Participant]],
    games_per_tie: int,
) -> dict[str, int]:
    seed_to_participant = {i + 1: p for i, p in enumerate(squad_participants)}

    round_id_by_key: dict[str, uuid.UUID] = {}
    for round_plan in plan.rounds:
        rnd = Round(
            organization_id=org_id, stage_id=stage.id, seq=round_plan.seq, label=round_plan.label
        )
        session.add(rnd)
        await session.flush()
        round_id_by_key[round_plan.key] = rnd.id

    tie_by_key: dict[str, Match] = {}
    for match_plan in plan.matches:
        tie = Match(
            organization_id=org_id,
            tournament_id=tournament_id,
            stage_id=stage.id,
            round_id=round_id_by_key.get(match_plan.round_key) if match_plan.round_key else None,
            status=MatchStatus.PENDING.value,
            contest_kind=ContestKind.TIE.value,
            result_payload={"gamesPerTie": games_per_tie, "legWins": {}},
            source_refs={},
        )
        session.add(tie)
        await session.flush()
        tie_by_key[match_plan.key] = tie

    tie_count = 0
    for match_plan in plan.matches:
        tie = tie_by_key[match_plan.key]
        sides_json: list[dict[str, Any]] = []
        resolved: list[uuid.UUID] = []
        has_ref = has_bye = False
        for side in match_plan.source_refs.sides:
            if isinstance(side, SeedRef):
                part = seed_to_participant[side.seed]
                sides_json.append({"participant": str(part.id)})
                resolved.append(part.id)
            elif isinstance(side, WinnerOfRef):
                sides_json.append({"winner_of": str(tie_by_key[side.match_key].id)})
                has_ref = True
            elif isinstance(side, ByeRef):
                sides_json.append({"bye": True})
                has_bye = True
        tie.source_refs = {"sides": sides_json, "franchiseTie": True}
        for part_id in resolved:
            session.add(
                MatchParticipant(
                    organization_id=org_id,
                    match_id=tie.id,
                    participant_id=part_id,
                )
            )
        fully_known = (
            not has_ref and not has_bye and len(resolved) == len(match_plan.source_refs.sides)
        )
        tie.status = (MatchStatus.SCHEDULED if fully_known else MatchStatus.PENDING).value
        tie_count += 1

    await session.flush()
    return {"ties": tie_count, "legs": 0}


async def rollup_leg_to_tie(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    leg_match: Match,
) -> bool:
    """Update parent tie from leg result. Returns True if tie just became terminal."""
    if leg_match.contest_kind != ContestKind.LEG.value or leg_match.parent_match_id is None:
        return False

    tie = await repo.get_match_with_participants(session, org_id, leg_match.parent_match_id)
    if tie is None or tie.contest_kind != ContestKind.TIE.value:
        return False

    payload = tie.result_payload or {}
    games_per_tie = int(payload.get("gamesPerTie") or 1)
    legs = await repo.list_leg_matches(session, org_id, tie.id)

    leg_outcomes: list[LegOutcome] = []

    for leg in legs:
        winner_side: int | None = None
        if leg.status not in _TERMINAL:
            leg_outcomes.append(LegOutcome(None))
            continue
        winner_mp = next(
            (mp for mp in leg.participants if mp.outcome == MatchOutcome.WIN.value), None
        )
        if winner_mp is None:
            leg_outcomes.append(LegOutcome(None))
            continue
        leg_refs = leg.source_refs or {}
        sides = leg_refs.get("sides") or []
        home_pair_id = sides[0].get("participant") if sides else None
        away_pair_id = sides[1].get("participant") if len(sides) > 1 else None
        winner_pid = str(winner_mp.participant_id)
        if winner_pid == home_pair_id:
            winner_side = 0
        elif winner_pid == away_pair_id:
            winner_side = 1
        leg_outcomes.append(LegOutcome(winner_side))

    state = rollup_legs(games_per_tie=games_per_tie, legs=tuple(leg_outcomes))
    tie.result_payload = {
        **payload,
        "gamesPerTie": games_per_tie,
        "legWins": {"home": state.home_leg_wins, "away": state.away_leg_wins},
    }

    ordered = _tie_side_participants(tie)
    if len(ordered) >= 2:
        ordered[0].score = Decimal(state.home_leg_wins)
        ordered[1].score = Decimal(state.away_leg_wins)

    if not state.decided:
        await session.flush()
        return False

    if state.winning_side is not None and len(ordered) >= 2:
        win_mp = ordered[state.winning_side]
        lose_mp = ordered[1 - state.winning_side]
        win_mp.outcome = MatchOutcome.WIN.value
        lose_mp.outcome = MatchOutcome.LOSS.value

    tie.status = MatchStatus.COMPLETED.value
    await session.flush()
    await advance_franchise_knockout(session, org_id=org_id, stage_id=tie.stage_id)
    return True


async def get_ties_board(
    session: AsyncSession, *, org_id: uuid.UUID, stage_id: uuid.UUID
) -> FranchiseTiesBoardView:
    stage = await repo.get_stage(session, org_id, stage_id)
    if stage is None:
        raise NotFoundError("Stage not found")

    cfg = stage.config or {}
    games_per_tie = int(cfg.get("gamesPerTie") or 1)
    ties = await repo.list_tie_matches(session, org_id, stage_id)
    views: list[FranchiseTieView] = []

    for tie in ties:
        legs = await repo.list_leg_matches(session, org_id, tie.id)
        payload = tie.result_payload or {}
        leg_wins = payload.get("legWins") or {}
        names: dict[uuid.UUID, str] = {}
        for mp in tie.participants:
            part = await session.get(Participant, mp.participant_id)
            if part:
                names[mp.participant_id] = part.display_name

        ordered = _tie_side_participants(tie)
        home_name = names.get(ordered[0].participant_id, "Home") if ordered else "Home"
        away_name = names.get(ordered[1].participant_id, "Away") if len(ordered) > 1 else "Away"

        leg_views: list[TieLegView] = []
        for leg in legs:
            refs = leg.source_refs or {}
            idx = int(refs.get("legIndex") or 0)
            sides = refs.get("sides") or []
            home_pair = away_pair = "—"
            if sides:
                hp = await session.get(Participant, uuid.UUID(sides[0]["participant"]))
                home_pair = hp.display_name if hp else "—"
            if len(sides) > 1:
                ap = await session.get(Participant, uuid.UUID(sides[1]["participant"]))
                away_pair = ap.display_name if ap else "—"
            leg_views.append(
                TieLegView(
                    id=leg.id,
                    status=leg.status,
                    leg_index=idx,
                    home_pair_name=home_pair,
                    away_pair_name=away_pair,
                )
            )

        views.append(
            FranchiseTieView(
                id=tie.id,
                status=tie.status,
                home_squad_name=home_name,
                away_squad_name=away_name,
                home_leg_wins=int(leg_wins.get("home") or 0),
                away_leg_wins=int(leg_wins.get("away") or 0),
                games_per_tie=int(payload.get("gamesPerTie") or games_per_tie),
                legs=leg_views,
            )
        )

    return FranchiseTiesBoardView(stage_id=stage_id, games_per_tie=games_per_tie, ties=views)


async def get_squad_standings(
    session: AsyncSession, *, org_id: uuid.UUID, stage_id: uuid.UUID
) -> SquadStandingsView:
    board = await get_ties_board(session, org_id=org_id, stage_id=stage_id)

    # Accumulate per-squad stats from completed ties.
    stats: dict[str, dict[str, int]] = {}

    def _row(name: str) -> dict[str, int]:
        if name not in stats:
            stats[name] = {
                "played": 0,
                "won": 0,
                "lost": 0,
                "drawn": 0,
                "leg_wins": 0,
                "leg_losses": 0,
            }
        return stats[name]

    for tie in board.ties:
        if tie.status not in ("completed", "walkover"):
            # still count leg wins even for in-progress ties
            pass
        home = _row(tie.home_squad_name)
        away = _row(tie.away_squad_name)
        h, a = tie.home_leg_wins, tie.away_leg_wins
        home["leg_wins"] += h
        home["leg_losses"] += a
        away["leg_wins"] += a
        away["leg_losses"] += h
        if tie.status in ("completed", "walkover"):
            home["played"] += 1
            away["played"] += 1
            if h > a:
                home["won"] += 1
                away["lost"] += 1
            elif a > h:
                away["won"] += 1
                home["lost"] += 1
            else:
                home["drawn"] += 1
                away["drawn"] += 1

    # Points: 2 per win, 1 per draw, 0 per loss.
    rows: list[SquadStandingRow] = []
    for name, s in stats.items():
        points = s["won"] * 2 + s["drawn"]
        rows.append(
            SquadStandingRow(
                rank=0,
                squad_name=name,
                played=s["played"],
                won=s["won"],
                lost=s["lost"],
                drawn=s["drawn"],
                leg_wins=s["leg_wins"],
                leg_losses=s["leg_losses"],
                points=points,
            )
        )

    rows.sort(key=lambda r: (-r.points, -r.leg_wins, r.squad_name))
    for i, row in enumerate(rows):
        row.rank = i + 1

    return SquadStandingsView(stage_id=stage_id, rows=rows)
