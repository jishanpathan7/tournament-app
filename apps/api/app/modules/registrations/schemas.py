"""Registration/participant API schemas (camelCase on the wire)."""

from __future__ import annotations

import datetime
import uuid
from typing import Any

from pydantic import Field, field_validator

from app.api.schemas import ApiModel
from app.db.enums import SkillLevel


class SubmitRegistrationRequest(ApiModel):
    # For pair/team divisions, form_response carries {"teamName": str, "players": [{userId|name}]}.
    form_response: dict[str, Any] = Field(default_factory=dict)
    skill_level: SkillLevel | None = None


class RegistrationResponse(ApiModel):
    id: uuid.UUID
    division_id: uuid.UUID
    submitted_by: uuid.UUID
    status: str
    skill_level: str | None
    participant_id: uuid.UUID | None
    # What the entrant submitted (team name / player names) — organizers need this to
    # review an application; the submitter already has it (they wrote it).
    form_response: dict[str, Any]
    created_at: datetime.datetime


class ApproveResult(ApiModel):
    registration_id: uuid.UUID
    status: str  # approved | waitlisted
    participant_id: uuid.UUID | None


class BulkApproveResult(ApiModel):
    approved: int
    waitlisted: int
    skipped: int


class ParticipantResponse(ApiModel):
    id: uuid.UUID
    division_id: uuid.UUID
    kind: str
    display_name: str
    email: str | None = None
    phone: str | None = None
    gender: str | None = None
    partner_preference: str | None = None
    seed: int | None
    status: str
    skill_level: str | None = None
    user_id: uuid.UUID | None
    team_id: uuid.UUID | None
    team_name: str | None = None
    created_at: datetime.datetime
    # Pre-check flags so the remove dialog can show state-aware warnings before confirming.
    has_published_pair: bool = False
    has_match_results: bool = False


class ParticipantUpdate(ApiModel):
    display_name: str | None = None
    email: str | None = None
    phone: str | None = None
    gender: str | None = None
    skill_level: SkillLevel | None = None
    partner_preference: str | None = None

    @field_validator("display_name")
    @classmethod
    def display_name_not_blank(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("display_name cannot be blank")
        return v


class RosterEntryItem(ApiModel):
    id: uuid.UUID
    user_id: uuid.UUID | None
    external_name: str | None
    role: str | None


class TeamResponse(ApiModel):
    id: uuid.UUID
    name: str
    captain_user_id: uuid.UUID | None
    roster: list[RosterEntryItem]
