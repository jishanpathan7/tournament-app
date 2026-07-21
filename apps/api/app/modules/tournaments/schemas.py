"""Tournament domain API schemas (camelCase on the wire)."""

from __future__ import annotations

import datetime
import uuid
from typing import Any

from pydantic import Field

from app.api.schemas import ApiModel
from app.db.enums import ParticipantKind, StageFormat, TournamentStatus, Visibility
from app.modules.venues.schemas import VenueResponse


class CreateTournamentRequest(ApiModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=140, pattern=r"^[a-z0-9-]+$")
    sport_key: str = Field(min_length=1, max_length=60)
    visibility: Visibility = Visibility.PRIVATE


class UpdateTournamentRequest(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    visibility: Visibility | None = None
    starts_at: datetime.datetime | None = None
    ends_at: datetime.datetime | None = None
    settings: dict[str, Any] | None = None
    auto_schedule: bool | None = None
    pair_creation_mode: str | None = None
    match_duration_minutes: int | None = Field(default=None, ge=5, le=240)
    venue_id: uuid.UUID | None = None
    clear_venue: bool | None = None


class StatusTransitionRequest(ApiModel):
    status: TournamentStatus


class PublishRequest(ApiModel):
    artifacts: list[str] = Field(default_factory=list)  # any of: draw | schedule | results


class PurgeTournamentRequest(ApiModel):
    """Echoing the name back is the guard on an irreversible delete."""

    confirm_name: str


class TournamentResponse(ApiModel):
    id: uuid.UUID
    slug: str
    name: str
    sport_key: str
    status: str
    visibility: str
    starts_at: datetime.datetime | None
    ends_at: datetime.datetime | None
    settings: dict[str, Any]
    venue_name: str | None
    venue: VenueResponse | None
    draw_published_at: datetime.datetime | None
    schedule_published_at: datetime.datetime | None
    results_published_at: datetime.datetime | None
    created_at: datetime.datetime


class CreateDivisionRequest(ApiModel):
    name: str = Field(min_length=1, max_length=160)
    participant_type: ParticipantKind
    capacity: int | None = Field(default=None, ge=1)
    reg_form: dict[str, Any] = Field(default_factory=dict)


class UpdateDivisionRequest(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    participant_type: ParticipantKind | None = None
    capacity: int | None = Field(default=None, ge=1)
    clear_capacity: bool = False


class DivisionResponse(ApiModel):
    id: uuid.UUID
    tournament_id: uuid.UUID
    name: str
    participant_type: str
    capacity: int | None
    reg_form: dict[str, Any]
    created_at: datetime.datetime


class CreateStageRequest(ApiModel):
    type: StageFormat
    seq: int = Field(default=0, ge=0)
    config: dict[str, Any] = Field(default_factory=dict)
    points_rule_id: uuid.UUID | None = None
    tiebreak_ruleset_id: uuid.UUID | None = None
    advances_n: int | None = Field(default=None, ge=1)


class UpdateStageConfigRequest(ApiModel):
    """Partial sport-config override for a stage (e.g. ``{"bestOf": 1}``).
    Only allowed before the stage is locked (first scored result). Snake_case and
    camelCase keys are both accepted; unknown keys are ignored."""

    config: dict[str, Any]


class StageResponse(ApiModel):
    id: uuid.UUID
    division_id: uuid.UUID
    type: str
    seq: int
    config: dict[str, Any]
    advances_n: int | None
    drawn: bool
    # True once any match has a real submitted result — mirrors the guard in
    # ``service.clear_draw``, so the UI can show "locked" without re-deriving it.
    locked: bool
    created_at: datetime.datetime


class DrawRequest(ApiModel):
    rng_seed: int | None = None  # provide for a reproducible random draw; omit to seed by order
    # Draw even if some approved participants haven't checked in (organizer override).
    override_readiness: bool = False


class DrawResponse(ApiModel):
    stage_id: uuid.UUID
    format: str
    groups: int
    rounds: int
    matches: int
    scheduled: int  # matches ready to play (all sides known)
    pending: int  # matches awaiting bracket resolution


class AdvanceToKnockoutRequest(ApiModel):
    take: int = Field(ge=2, le=64, description="Number of top-ranked participants to advance")
    rng_seed: int | None = None


class AdvanceToKnockoutResponse(ApiModel):
    stage_id: uuid.UUID
    format: str
    matches: int
    scheduled: int
    pending: int


class ActivityEventView(ApiModel):
    """One row of the org-wide audit trail (`AuditLog`), scoped to a single tournament —
    the source for the Match Center's activity timeline."""

    id: uuid.UUID
    action: str  # e.g. "match.completed", "stage.generated", "tournament.status_changed"
    entity: str  # "tournament" | "division" | "stage" | "match"
    entity_id: uuid.UUID
    actor_id: uuid.UUID | None
    before: dict[str, Any] | None
    after: dict[str, Any] | None
    created_at: datetime.datetime
