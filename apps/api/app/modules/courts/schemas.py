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
