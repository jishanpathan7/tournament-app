"""Participant portal use cases — cross-org aggregation for the authenticated user."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import MatchStatus

if TYPE_CHECKING:
    from app.db.models.competition import Match, MatchParticipant
from app.db.session import set_org_context
from app.modules.auth import repository as auth_repo
from app.modules.me import repository as repo
from app.modules.me.schemas import (
    PortalHomeView,
    PortalMatchView,
    PortalParticipationView,
    PortalRegistrationView,
)

_TERMINAL = {
    MatchStatus.COMPLETED.value,
    MatchStatus.WALKOVER.value,
    MatchStatus.NO_SHOW.value,
}
_UPCOMING = {
    MatchStatus.SCHEDULED.value,
    MatchStatus.LIVE.value,
    MatchStatus.PENDING.value,
}


def _score_summary(match: Match, my_mp: MatchParticipant) -> str | None:
    if match.status not in _TERMINAL:
        return None
    if my_mp.score is not None:
        others = [mp for mp in match.participants if mp.participant_id != my_mp.participant_id]
        against = int(others[0].score) if others and others[0].score is not None else None
        if against is not None:
            return f"{int(my_mp.score)}–{against}"
    if my_mp.outcome == "win":
        return "W"
    if my_mp.outcome == "loss":
        return "L"
    return None


def _build_match_view(
    match: Match,
    *,
    my_mp: MatchParticipant,
    opponent_label: str,
    part_view: PortalParticipationView,
    org_id: uuid.UUID,
    org_name: str,
) -> PortalMatchView:
    return PortalMatchView(
        id=match.id,
        status=match.status,
        contest_kind=match.contest_kind,
        parent_match_id=match.parent_match_id,
        tournament_id=part_view.tournament_id,
        tournament_name=part_view.tournament_name,
        tournament_slug=part_view.tournament_slug,
        division_name=part_view.division_name,
        organization_id=org_id,
        organization_name=org_name,
        my_participant_id=my_mp.participant_id,
        opponent_label=opponent_label,
        round_label=match.round.label if match.round else None,
        scheduled_at=match.scheduled_at,
        score_summary=_score_summary(match, my_mp),
    )


async def get_portal_home(session: AsyncSession, user_id: uuid.UUID) -> PortalHomeView:
    memberships = await auth_repo.list_memberships(session, user_id)

    registrations: list[PortalRegistrationView] = []
    participations: list[PortalParticipationView] = []
    participation_by_id: dict[uuid.UUID, PortalParticipationView] = {}
    upcoming: list[PortalMatchView] = []
    recent: list[PortalMatchView] = []
    seen_reg: set[uuid.UUID] = set()
    seen_part: set[uuid.UUID] = set()
    seen_match: set[uuid.UUID] = set()

    for membership in memberships:
        org = membership.organization
        org_id = membership.organization_id
        org_name = org.name if org else str(org_id)[:8]
        await set_org_context(session, org_id)

        org_participant_ids: list[uuid.UUID] = []

        for r in await repo.list_my_registrations(session, user_id):
            if r.id in seen_reg:
                continue
            seen_reg.add(r.id)
            div = r.division
            tour = div.tournament if div else None
            registrations.append(
                PortalRegistrationView(
                    id=r.id,
                    status=r.status,
                    skill_level=r.skill_level,
                    division_id=r.division_id,
                    division_name=div.name if div else "",
                    tournament_id=tour.id if tour else div.tournament_id,
                    tournament_name=tour.name if tour else "",
                    tournament_slug=tour.slug if tour else "",
                    organization_id=org_id,
                    organization_name=org_name,
                )
            )

        for p in list(await repo.list_my_participations(session, user_id)) + list(
            await repo.list_my_roster_participations(session, user_id)
        ):
            if p.id in seen_part:
                continue
            seen_part.add(p.id)
            org_participant_ids.append(p.id)
            div = p.division
            tour = div.tournament if div else None
            view = PortalParticipationView(
                id=p.id,
                display_name=p.display_name,
                kind=p.kind,
                status=p.status,
                attendance=p.attendance,
                division_id=p.division_id,
                division_name=div.name if div else "",
                tournament_id=tour.id if tour else div.tournament_id,
                tournament_name=tour.name if tour else "",
                tournament_slug=tour.slug if tour else "",
                organization_id=org_id,
                organization_name=org_name,
            )
            participations.append(view)
            participation_by_id[p.id] = view

        if not org_participant_ids:
            continue

        for match in await repo.list_matches_for_participants(session, org_participant_ids):
            if match.id in seen_match:
                continue
            seen_match.add(match.id)

            my_mp = next(
                (mp for mp in match.participants if mp.participant_id in org_participant_ids),
                None,
            )
            if my_mp is None:
                continue
            part_view = participation_by_id.get(my_mp.participant_id)
            if part_view is None:
                continue

            other_mp = next(
                (mp for mp in match.participants if mp.participant_id != my_mp.participant_id),
                None,
            )
            opponent_label = "TBD"
            if other_mp:
                opp = (await repo.load_participants_by_id(session, [other_mp.participant_id])).get(
                    other_mp.participant_id
                )
                if opp:
                    opponent_label = opp.display_name

            match_view = _build_match_view(
                match,
                my_mp=my_mp,
                opponent_label=opponent_label,
                part_view=part_view,
                org_id=org_id,
                org_name=org_name,
            )
            if match.status in _TERMINAL:
                recent.append(match_view)
            elif match.status in _UPCOMING:
                upcoming.append(match_view)

    upcoming.sort(key=lambda m: (m.scheduled_at is None, m.scheduled_at or ""))
    recent.sort(key=lambda m: m.scheduled_at or "", reverse=True)

    return PortalHomeView(
        registrations=registrations,
        participations=participations,
        upcoming_matches=upcoming[:20],
        recent_matches=recent[:20],
    )
