"""Franchise tie API schemas."""

from __future__ import annotations

import uuid

from pydantic import Field

from app.api.schemas import ApiModel


class FranchiseDrawRequest(ApiModel):
    games_per_tie: int | None = Field(
        default=None,
        ge=1,
        le=9,
        description="Doubles legs per squad-vs-squad tie; defaults to min pairs per squad",
    )


class FranchiseKnockoutDrawRequest(ApiModel):
    source_stage_id: uuid.UUID | None = Field(
        default=None,
        description="Franchise RR stage whose squad standings seed the bracket",
    )
    advance_count: int | None = Field(
        default=None,
        ge=2,
        le=32,
        description="Top N squads from source standings; defaults to all squads",
    )
    games_per_tie: int | None = Field(default=None, ge=1, le=9)


class FranchiseDrawSummary(ApiModel):
    ties: int
    legs: int
    games_per_tie: int
    squad_count: int


class FranchiseDrawResponse(ApiModel):
    stage_id: uuid.UUID
    summary: FranchiseDrawSummary


class TieLegView(ApiModel):
    id: uuid.UUID
    status: str
    leg_index: int
    home_pair_name: str
    away_pair_name: str


class FranchiseTieView(ApiModel):
    id: uuid.UUID
    status: str
    home_squad_name: str
    away_squad_name: str
    home_leg_wins: int
    away_leg_wins: int
    games_per_tie: int
    legs: list[TieLegView]


class FranchiseTiesBoardView(ApiModel):
    stage_id: uuid.UUID
    games_per_tie: int
    ties: list[FranchiseTieView]


class SquadStandingRow(ApiModel):
    rank: int
    squad_name: str
    played: int
    won: int
    lost: int
    drawn: int
    leg_wins: int
    leg_losses: int
    points: int


class SquadStandingsView(ApiModel):
    stage_id: uuid.UUID
    rows: list[SquadStandingRow]
