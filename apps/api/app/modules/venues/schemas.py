"""Venue API schemas (camelCase on the wire)."""

from __future__ import annotations

import uuid

from pydantic import Field

from app.api.schemas import ApiModel


class CreateVenueRequest(ApiModel):
    name: str = Field(min_length=1, max_length=200)
    address: str | None = Field(default=None, max_length=500)
    maps_url: str | None = Field(default=None, max_length=2000)


class UpdateVenueRequest(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    address: str | None = Field(default=None, max_length=500)
    clear_address: bool = False
    maps_url: str | None = Field(default=None, max_length=2000)
    clear_maps_url: bool = False


class VenueResponse(ApiModel):
    id: uuid.UUID
    name: str
    address: str | None
    maps_url: str | None
