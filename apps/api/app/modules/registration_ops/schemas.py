"""Registration Operations API schemas (camelCase on the wire) — imports, attendance,
and readiness."""

from __future__ import annotations

import datetime
import uuid

from pydantic import Field

from app.api.schemas import ApiModel

# ---- imports ----


class ImportFieldInfo(ApiModel):
    key: str  # "name" | "email" | "skillLevel" | "preferredPartnerName"
    label: str
    required: bool


class ImportSourceInfo(ApiModel):
    key: str
    label: str
    target_fields: list[ImportFieldInfo]


class DetectColumnsRequest(ApiModel):
    source: str
    raw: str


class DetectColumnsResponse(ApiModel):
    columns: list[str]
    sample_rows: list[dict[str, str]]
    suggested_mapping: dict[str, str] = {}


class ImportRequest(ApiModel):
    """Shared shape for preview + commit — the raw upload, the chosen source, and the
    column → target-field mapping. Preview is a dry run; commit applies it."""

    source: str
    raw: str
    mapping: dict[str, str] = Field(default_factory=dict)  # targetField -> sourceColumn
    update_existing: bool = False
    auto_approve: bool = False


class PreviewRow(ApiModel):
    row_number: int
    status: str  # new | update | duplicate | invalid
    values: dict[str, str | None]
    messages: list[str]


class ImportPreviewSummary(ApiModel):
    total: int
    new: int
    update: int
    duplicate: int
    invalid: int


class ImportPreview(ApiModel):
    columns: list[str]
    rows: list[PreviewRow]
    summary: ImportPreviewSummary


class ImportResult(ApiModel):
    batch_id: uuid.UUID
    imported: int
    updated: int
    skipped: int


class SaveMappingTemplateRequest(ApiModel):
    name: str = Field(min_length=1, max_length=120)
    source: str
    mapping: dict[str, str]


class MappingTemplateView(ApiModel):
    id: uuid.UUID
    name: str
    source: str
    mapping: dict[str, str]
    created_at: datetime.datetime


# ---- attendance / check-in ----


class CheckInRequest(ApiModel):
    """Set attendance for a single participant. ``status`` ∈ pending|checked_in|absent."""

    status: str


class BulkCheckInRequest(ApiModel):
    participant_ids: list[uuid.UUID] = Field(min_length=1)
    status: str


class ParticipantAttendanceView(ApiModel):
    id: uuid.UUID
    division_id: uuid.UUID
    kind: str
    display_name: str
    status: str  # registration lifecycle
    attendance: str  # pending | checked_in | absent
    checked_in_at: datetime.datetime | None
    seed: int | None


class BulkCheckInResult(ApiModel):
    updated: list[uuid.UUID]
    attendance: str


# ---- readiness ----


class DivisionReadinessView(ApiModel):
    division_id: uuid.UUID
    division_name: str
    participant_type: str
    approved: int
    checked_in: int
    pending: int
    absent: int
    # Registered entrants not yet a competing participant (awaiting approval/pairing) —
    # the "missing players / missing partners" signal.
    unpaired_entrants: int
    drawn: bool
    ready_for_draw: bool  # enough checked-in participants, not yet drawn
    ready_for_start: bool  # drawn + everyone in the draw checked in
    blockers: list[str]


class TournamentReadinessView(ApiModel):
    tournament_id: uuid.UUID
    divisions: list[DivisionReadinessView]
    total_checked_in: int
    total_pending: int
    squad_count: int = 0
    unassigned_squad_members: int = 0
    squads_ready: bool = True
