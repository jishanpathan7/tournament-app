"""Courts API schemas (camelCase on the wire)."""

from __future__ import annotations

import datetime
import uuid

from pydantic import Field

from app.api.schemas import ApiModel


class CreateVenueRequest(ApiModel):
    name: str = Field(min_length=1, max_length=200)
    address: str | None = None


class VenueView(ApiModel):
    id: uuid.UUID
    name: str
    address: str | None
    created_at: datetime.datetime


class CreateCourtRequest(ApiModel):
    venue_id: uuid.UUID
    name: str = Field(min_length=1, max_length=80)


class UpdateCourtRequest(ApiModel):
    """Partial update — omitted fields are left unchanged."""

    name: str | None = Field(default=None, min_length=1, max_length=80)
    status: str | None = None


class CourtView(ApiModel):
    id: uuid.UUID
    venue_id: uuid.UUID
    venue_name: str
    name: str
    status: str
    created_at: datetime.datetime


class AssignCourtRequest(ApiModel):
    court_id: uuid.UUID


class TournamentCourtView(ApiModel):
    id: uuid.UUID
    tournament_id: uuid.UUID
    court: CourtView
    created_at: datetime.datetime


class BulkCreateCourtsRequest(ApiModel):
    """Create numbered courts at a venue and assign them to the tournament."""

    venue_id: uuid.UUID | None = None
    new_venue_name: str | None = Field(default=None, min_length=1, max_length=200)
    count: int = Field(ge=1, le=50)
    name_prefix: str = Field(default="Court ", min_length=1, max_length=70)
    start_number: int = Field(default=1, ge=1)


class BulkCreateCourtsResponse(ApiModel):
    created: list[TournamentCourtView]


class BulkRemoveCourtsRequest(ApiModel):
    court_ids: list[uuid.UUID] = Field(min_length=1)


class BulkRemoveCourtsResponse(ApiModel):
    removed: list[uuid.UUID]
