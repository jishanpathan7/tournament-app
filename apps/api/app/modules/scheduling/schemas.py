"""Scheduling API schemas (camelCase on the wire)."""

from __future__ import annotations

import datetime
import uuid

from pydantic import Field

from app.api.schemas import ApiModel
from app.modules.courts.schemas import CourtView
from app.modules.scoring.schemas import MatchView


class ScheduleAssignRequest(ApiModel):
    court_id: uuid.UUID
    scheduled_at: datetime.datetime
    duration_minutes: int = Field(default=30, ge=5, le=480)


class ConflictView(ApiModel):
    kind: str  # "court_overlap" | "participant_overlap" | "team_overlap"
    match_id: uuid.UUID
    other_match_id: uuid.UUID
    participant_id: uuid.UUID | None = None
    message: str


class ScheduleResultView(ApiModel):
    match: MatchView
    conflicts: list[ConflictView]


class ScheduleCheckRequest(ApiModel):
    court_id: uuid.UUID
    scheduled_at: datetime.datetime
    duration_minutes: int = Field(default=30, ge=5, le=480)


class ScheduleCheckResponse(ApiModel):
    conflicts: list[ConflictView]


class BulkScheduleItem(ApiModel):
    match_id: uuid.UUID
    court_id: uuid.UUID
    scheduled_at: datetime.datetime
    duration_minutes: int = Field(default=30, ge=5, le=480)


class BulkScheduleRequest(ApiModel):
    assignments: list[BulkScheduleItem] = Field(min_length=1)


class BulkScheduleResponse(ApiModel):
    results: list[ScheduleResultView]


class CourtQueueView(ApiModel):
    court: CourtView
    current_match: MatchView | None
    next_match: MatchView | None
    is_delayed: bool


class ScheduleQueueView(ApiModel):
    courts: list[CourtQueueView]
    # Ready to play (bracket sides resolved) but no court/time assigned yet.
    unscheduled: list[MatchView]
    # Bracket sides not resolved yet — not schedulable.
    pending: list[MatchView]
