"""Portal API schemas."""

from __future__ import annotations

import datetime
import uuid

from app.api.schemas import ApiModel


class PortalRegistrationView(ApiModel):
    id: uuid.UUID
    status: str
    skill_level: str | None
    division_id: uuid.UUID
    division_name: str
    tournament_id: uuid.UUID
    tournament_name: str
    tournament_slug: str
    organization_id: uuid.UUID
    organization_name: str


class PortalParticipationView(ApiModel):
    id: uuid.UUID
    display_name: str
    kind: str
    status: str
    attendance: str
    division_id: uuid.UUID
    division_name: str
    tournament_id: uuid.UUID
    tournament_name: str
    tournament_slug: str
    organization_id: uuid.UUID
    organization_name: str


class PortalMatchView(ApiModel):
    id: uuid.UUID
    status: str
    contest_kind: str
    parent_match_id: uuid.UUID | None
    tournament_id: uuid.UUID
    tournament_name: str
    tournament_slug: str
    division_name: str
    organization_id: uuid.UUID
    organization_name: str
    my_participant_id: uuid.UUID
    opponent_label: str
    round_label: str | None
    scheduled_at: datetime.datetime | None
    score_summary: str | None
    is_mine: bool = True


class PortalHomeView(ApiModel):
    registrations: list[PortalRegistrationView]
    participations: list[PortalParticipationView]
    upcoming_matches: list[PortalMatchView]
    recent_matches: list[PortalMatchView]
