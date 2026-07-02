"""Scoring API schemas (camelCase on the wire)."""

from __future__ import annotations

import datetime
import uuid
from typing import Any

from pydantic import Field

from app.api.schemas import ApiModel


class ScoreRequest(ApiModel):
    # The sport-specific result payload — validated + interpreted by the Sport Profile,
    # opaque to the domain (e.g. badminton: {"games": [[21,15],[21,18]], "endedBy": "..."}).
    payload: dict[str, Any] = Field(default_factory=dict)


class MatchSideView(ApiModel):
    participant_id: uuid.UUID
    outcome: str | None
    score_for: int | None
    score_against: int | None
    rank: int | None


class MatchView(ApiModel):
    id: uuid.UUID
    stage_id: uuid.UUID
    status: str
    sides: list[MatchSideView]
    result_payload: dict[str, Any]
    # Human labels for bracket/fixture rendering — already computed by the format engine
    # onto Round.label / Group.name at draw time; there is no dedicated Round/Group
    # endpoint, so the client needs these here to render "Semifinal" / "Round Robin"
    # instead of raw UUIDs.
    round_id: uuid.UUID | None
    round_seq: int | None
    round_label: str | None
    group_id: uuid.UUID | None
    group_name: str | None
    updated_at: datetime.datetime


class StandingRowView(ApiModel):
    participant_id: uuid.UUID
    group_id: uuid.UUID | None
    played: int
    won: int
    drawn: int
    lost: int
    points: float
    score_for: int
    score_against: int
    diff: int
    rank: int | None


class StandingsView(ApiModel):
    stage_id: uuid.UUID
    rows: list[StandingRowView]
