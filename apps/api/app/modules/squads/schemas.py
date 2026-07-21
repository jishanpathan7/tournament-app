"""Squad (franchise team) API schemas."""

from __future__ import annotations

import uuid

from pydantic import Field

from app.api.schemas import ApiModel


class SquadMemberView(ApiModel):
    registration_id: uuid.UUID
    display_name: str
    skill_level: str | None
    division_id: uuid.UUID
    division_name: str
    skill_weight: float


class SquadView(ApiModel):
    id: uuid.UUID
    name: str
    sort_order: int
    captain_registration_id: uuid.UUID | None
    member_count: int
    total_skill_weight: float
    members: list[SquadMemberView]


class UnassignedRegistrationView(ApiModel):
    registration_id: uuid.UUID
    display_name: str
    skill_level: str | None
    division_id: uuid.UUID
    division_name: str
    skill_weight: float
    status: str


class SquadSummary(ApiModel):
    squad_count: int
    assigned: int
    unassigned: int
    eligible: int


class TournamentSquadsView(ApiModel):
    tournament_id: uuid.UUID
    squads: list[SquadView]
    unassigned: list[UnassignedRegistrationView]
    summary: SquadSummary


class CreateSquadRequest(ApiModel):
    name: str = Field(min_length=1, max_length=160)


class UpdateSquadRequest(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    captain_registration_id: uuid.UUID | None = None
    clear_captain: bool = False


class AssignMemberRequest(ApiModel):
    registration_id: uuid.UUID


class SwapMembersRequest(ApiModel):
    """Atomically trade one member between two squads (both move or neither does)."""

    squad_a_id: uuid.UUID
    registration_a_id: uuid.UUID
    squad_b_id: uuid.UUID
    registration_b_id: uuid.UUID


class AutoDistributeRequest(ApiModel):
    team_count: int = Field(ge=2, le=32)
    division_id: uuid.UUID | None = None
    replace_existing: bool = False


class AutoDistributeResponse(ApiModel):
    squads: list[SquadView]
    summary: SquadSummary
