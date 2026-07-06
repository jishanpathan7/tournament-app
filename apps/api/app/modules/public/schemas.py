"""Public (anonymous) microsite API schemas (camelCase on the wire).

Deliberately separate from the authenticated schemas they're adjacent to
(`tournaments.schemas`, `registrations.schemas`) — the whole point of this module is a
curated, PII-free view. Never add `user_id`, `team_id`, `submitted_by`, `actor_id`, or
anything else that traces back to an account here; if a field wouldn't be safe to put
on a physical scoreboard, it doesn't belong in this file. Match/standings shapes are
reused as-is from `scoring.schemas` — they were already PII-free.
"""

from __future__ import annotations

import datetime
import uuid
from typing import Any

from app.api.schemas import ApiModel


class PublicOrgView(ApiModel):
    slug: str
    name: str
    branding: dict[str, Any]


class PublicVenueView(ApiModel):
    name: str
    address: str | None
    maps_url: str | None


class PublicTournamentView(ApiModel):
    id: uuid.UUID
    slug: str
    name: str
    sport_key: str
    status: str
    visibility: str
    starts_at: datetime.datetime | None
    ends_at: datetime.datetime | None
    venue_name: str | None
    venue: PublicVenueView | None
    draw_published_at: datetime.datetime | None
    schedule_published_at: datetime.datetime | None
    results_published_at: datetime.datetime | None
    organization: PublicOrgView


class PublicDivisionView(ApiModel):
    id: uuid.UUID
    name: str
    participant_type: str
    capacity: int | None
    approved_count: int


class PublicStageView(ApiModel):
    id: uuid.UUID
    division_id: uuid.UUID
    type: str
    seq: int
    drawn: bool


class PublicParticipantView(ApiModel):
    id: uuid.UUID
    division_id: uuid.UUID
    kind: str
    display_name: str
    seed: int | None


class PublicTournamentSearchResult(ApiModel):
    slug: str
    name: str
    sport_key: str
    status: str
    organization_name: str
    organization_slug: str


class PublicSubmitRegistrationRequest(ApiModel):
    name: str
    email: str | None = None
    skill_level: str | None = None
    preferred_partner_name: str | None = None


class PublicRegistrationSubmittedView(ApiModel):
    id: uuid.UUID
    status: str
    division_id: uuid.UUID


class PlayerStatRow(ApiModel):
    participant_id: uuid.UUID
    display_name: str
    played: int
    won: int
    lost: int
    drawn: int
    win_rate: float
    squad_name: str | None


class PlayerStatsView(ApiModel):
    rows: list[PlayerStatRow]
