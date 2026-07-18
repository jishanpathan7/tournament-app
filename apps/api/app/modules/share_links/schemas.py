"""Share-link API schemas."""

from __future__ import annotations

import datetime
import uuid

from pydantic import Field

from app.api.schemas import ApiModel
from app.modules.scoring.schemas import SportMatchConfigView


class CreateMatchScorekeeperLinkRequest(ApiModel):
    expires_in_hours: int = Field(default=48, ge=1, le=720)  # default 48h, max 30 days
    recipient_email: str | None = Field(default=None, max_length=320)
    recipient_name: str | None = Field(default=None, max_length=200)


class ScorekeeperLinkView(ApiModel):
    id: uuid.UUID
    match_id: uuid.UUID
    tournament_id: uuid.UUID
    expires_at: datetime.datetime | None
    revoked: bool
    url: str | None = None


class ScorekeeperMatchCardView(ApiModel):
    match_id: uuid.UUID
    side_labels: list[str]
    side_team_names: list[str | None] = []
    match_status: str
    round_label: str | None
    court_id: uuid.UUID | None
    court_name: str | None = None
    scheduled_at: datetime.datetime | None
    group_name: str | None


class ScorekeeperSessionView(ApiModel):
    """Public scorekeeper page — one match only, resolved from the token."""

    tournament_id: uuid.UUID
    tournament_name: str
    match: ScorekeeperMatchCardView
    sport_config: SportMatchConfigView


class ScorekeeperScoreRequest(ApiModel):
    payload: dict


class CreateDivisionCheckInLinkRequest(ApiModel):
    expires_in_hours: int = Field(default=24, ge=1, le=168)  # default 24h, max 7 days


class CheckInLinkView(ApiModel):
    id: uuid.UUID
    division_id: uuid.UUID
    tournament_id: uuid.UUID
    expires_at: datetime.datetime | None
    revoked: bool
    url: str | None = None


class CheckInParticipantView(ApiModel):
    id: uuid.UUID
    display_name: str
    attendance: str


class CheckInSessionView(ApiModel):
    tournament_id: uuid.UUID
    tournament_name: str
    division_id: uuid.UUID
    division_name: str
    participants: list[CheckInParticipantView]


class PublicCheckInRequest(ApiModel):
    participant_id: uuid.UUID
