"""Import pipeline (source-agnostic): parse → map → validate → dedupe → preview/commit.

Imports create **Registrations** in a division (submitted by the importing organizer,
with ``form_response.name`` + ``skill_level``) — the same shape self-service sign-ups
produce, so imported entrants flow straight into approval and Smart Pairing. The parse
step is delegated to a pluggable ``ImportSource``; everything after is provider-neutral.
Never commits — the request session owns the transaction.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import NotFoundError, ValidationError
from app.core import audit
from app.core.events import emit_event
from app.core.factory import get_broadcaster
from app.db.enums import RegistrationStatus, SkillLevel
from app.db.models import Division, ImportBatch, MappingTemplate, Registration
from app.modules.registration_ops import events
from app.modules.registration_ops import repository as repo
from app.modules.registration_ops.importers import get_source, list_sources
from app.modules.registration_ops.importers.base import ImportError_
from app.modules.registration_ops.schemas import (
    ImportFieldInfo,
    ImportPreview,
    ImportPreviewSummary,
    ImportSourceInfo,
    MappingTemplateView,
    PreviewRow,
)
from app.modules.registrations.partner_resolution import resolve_preferred_partner_ids
from app.realtime.channels import org_channel

# The canonical fields any source maps onto. Adding a field here is the only change
# needed to import a new attribute — sources stay dumb (columns → strings).
IMPORT_FIELDS: tuple[tuple[str, str, bool], ...] = (
    ("name", "Name", True),
    ("email", "Email", False),
    ("skillLevel", "Skill level", False),
    ("preferredPartnerName", "Preferred partner", False),
)
_REQUIRED = {key for key, _label, required in IMPORT_FIELDS if required}

# Keyword hints for auto-mapping: if any hint is a substring of a column header
# (case-insensitive) the column is pre-mapped to that field. More specific hints
# should come before general ones to avoid false positives.
_FIELD_HINTS: dict[str, list[str]] = {
    "preferredPartnerName": [
        "preferred partner",
        "partner name",
        "partner preference",
        "enter your partner",
        "partner",
        "pair with",
        "paired with",
    ],
    "skillLevel": ["skill level", "skill", "level", "rating", "grade"],
    "email": ["email", "e-mail", "mail"],
    "name": ["full name", "player name", "participant name", "name"],
}


def suggest_mapping(columns: list[str]) -> dict[str, str]:
    """Return a field_key → column_name mapping inferred from column headers.

    Each column is matched against ``_FIELD_HINTS`` in field order. The first
    hint that is a substring of the (normalised) column header wins. A column is
    never mapped to more than one field; a field is never claimed by more than
    one column.
    """
    mapping: dict[str, str] = {}
    claimed_columns: set[str] = set()
    for field_key, hints in _FIELD_HINTS.items():
        if field_key in mapping:
            continue
        for col in columns:
            if col in claimed_columns:
                continue
            col_lower = col.strip().lower()
            if any(hint in col_lower for hint in hints):
                mapping[field_key] = col
                claimed_columns.add(col)
                break
    return mapping


# Lenient skill-label normalization so "Adv", "advanced", "3" all resolve.
_SKILL_ALIASES: dict[str, str] = {
    "beginner": SkillLevel.BEGINNER.value,
    "beg": SkillLevel.BEGINNER.value,
    "b": SkillLevel.BEGINNER.value,
    "1": SkillLevel.BEGINNER.value,
    "intermediate": SkillLevel.INTERMEDIATE.value,
    "int": SkillLevel.INTERMEDIATE.value,
    "i": SkillLevel.INTERMEDIATE.value,
    "2": SkillLevel.INTERMEDIATE.value,
    "advanced": SkillLevel.ADVANCED.value,
    "adv": SkillLevel.ADVANCED.value,
    "a": SkillLevel.ADVANCED.value,
    "3": SkillLevel.ADVANCED.value,
}


def normalize_skill(value: str) -> str | None:
    return _SKILL_ALIASES.get(value.strip().lower())


def list_source_info() -> list[ImportSourceInfo]:
    fields = [ImportFieldInfo(key=k, label=lbl, required=req) for k, lbl, req in IMPORT_FIELDS]
    return [
        ImportSourceInfo(key=s.key, label=s.label, target_fields=fields) for s in list_sources()
    ]


def detect_columns(
    source_key: str, raw: str
) -> tuple[list[str], list[dict[str, str]], dict[str, str]]:
    table = _parse(source_key, raw)
    return table.columns, table.rows[:5], suggest_mapping(table.columns)


@dataclass
class _EvaluatedRow:
    row_number: int
    status: str  # new | update | duplicate | invalid
    values: dict[str, str | None]
    messages: list[str]
    # The existing registration this row updates (only set when status == "update").
    existing_id: uuid.UUID | None = None


def _parse(source_key: str, raw: str):  # type: ignore[no-untyped-def]
    source = get_source(source_key)
    if source is None:
        raise ValidationError(f"unknown import source {source_key!r}", code="unknown_source")
    try:
        return source.parse(raw)
    except ImportError_ as exc:
        raise ValidationError(str(exc), code="unparseable_import") from exc


def _dedupe_key(name: str | None, email: str | None) -> str | None:
    if email:
        return f"email:{email.strip().lower()}"
    if name:
        return f"name:{name.strip().lower()}"
    return None


def _existing_index(registrations: Sequence[Registration]) -> dict[str, uuid.UUID]:
    """Map each existing registration to its dedupe key so imported rows can match."""
    index: dict[str, uuid.UUID] = {}
    for reg in registrations:
        form = reg.form_response or {}
        key = _dedupe_key(form.get("name"), form.get("email"))
        if key is not None and key not in index:
            index[key] = reg.id
    return index


def _evaluate(
    table_columns: list[str],
    rows: list[dict[str, str]],
    mapping: dict[str, str],
    existing: dict[str, uuid.UUID],
    *,
    update_existing: bool,
) -> list[_EvaluatedRow]:
    missing_required = _REQUIRED - set(mapping)
    seen_keys: set[str] = set()
    evaluated: list[_EvaluatedRow] = []

    for i, row in enumerate(rows):
        messages: list[str] = []
        values: dict[str, str | None] = {}
        for key, _label, _req in IMPORT_FIELDS:
            column = mapping.get(key)
            raw_val = (row.get(column, "") if column else "").strip()
            values[key] = raw_val or None

        if missing_required:
            messages.append(
                f"mapping is missing required field(s): {', '.join(sorted(missing_required))}"
            )

        if not values.get("name"):
            messages.append("name is required")

        if values.get("skillLevel"):
            normalized = normalize_skill(values["skillLevel"] or "")
            if normalized is None:
                messages.append(f"unrecognized skill level {values['skillLevel']!r}")
            values["skillLevel"] = normalized

        status = "new"
        existing_id: uuid.UUID | None = None
        if messages:
            status = "invalid"
        else:
            dedupe = _dedupe_key(values.get("name"), values.get("email"))
            if dedupe is not None and dedupe in seen_keys:
                status = "duplicate"
                messages.append("duplicate of an earlier row in this file")
            elif dedupe is not None and dedupe in existing:
                existing_id = existing[dedupe]
                if update_existing:
                    status = "update"
                else:
                    status = "duplicate"
                    messages.append("already registered in this division")
            if dedupe is not None:
                seen_keys.add(dedupe)

        evaluated.append(
            _EvaluatedRow(
                row_number=i + 1,
                status=status,
                values=values,
                messages=messages,
                existing_id=existing_id,
            )
        )
    return evaluated


def _summary(rows: list[_EvaluatedRow]) -> ImportPreviewSummary:
    def count(status: str) -> int:
        return sum(1 for r in rows if r.status == status)

    return ImportPreviewSummary(
        total=len(rows),
        new=count("new"),
        update=count("update"),
        duplicate=count("duplicate"),
        invalid=count("invalid"),
    )


async def preview(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    division_id: uuid.UUID,
    source: str,
    raw: str,
    mapping: dict[str, str],
    update_existing: bool,
) -> ImportPreview:
    await _require_division(session, org_id, division_id)
    table = _parse(source, raw)
    existing = _existing_index(await repo.list_registrations(session, org_id, division_id))
    evaluated = _evaluate(
        table.columns, table.rows, mapping, existing, update_existing=update_existing
    )
    return ImportPreview(
        columns=table.columns,
        rows=[
            PreviewRow(
                row_number=r.row_number, status=r.status, values=r.values, messages=r.messages
            )
            for r in evaluated
        ],
        summary=_summary(evaluated),
    )


async def commit(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    division_id: uuid.UUID,
    source: str,
    raw: str,
    mapping: dict[str, str],
    update_existing: bool,
    auto_approve: bool = False,
) -> ImportBatch:
    division = await _require_division(session, org_id, division_id)
    table = _parse(source, raw)
    existing = _existing_index(await repo.list_registrations(session, org_id, division_id))
    evaluated = _evaluate(
        table.columns, table.rows, mapping, existing, update_existing=update_existing
    )

    imported = updated = skipped = 0
    for row in evaluated:
        if row.status == "new":
            session.add(
                _registration_from_row(
                    org_id, actor_id, division_id, row, auto_approve=auto_approve
                )
            )
            imported += 1
        elif row.status == "update" and row.existing_id is not None:
            reg = await session.get(Registration, row.existing_id)
            if reg is not None:
                _apply_row(reg, row)
                updated += 1
            else:  # pragma: no cover - raced deletion
                skipped += 1
        else:
            skipped += 1
    await session.flush()

    # Link partner-name columns to registration ids so Smart Pairing honors pre-formed pairs.
    division_regs = await repo.list_registrations(session, org_id, division_id)
    resolve_preferred_partner_ids(division_regs)
    await session.flush()

    batch = ImportBatch(
        organization_id=org_id,
        division_id=division_id,
        source=source,
        actor_id=actor_id,
        imported_count=imported,
        updated_count=updated,
        skipped_count=skipped,
    )
    session.add(batch)
    await session.flush()

    audit.record(
        session,
        organization_id=org_id,
        actor_id=actor_id,
        action=events.IMPORT_COMMITTED,
        entity="import_batch",
        entity_id=batch.id,
        after={"imported": imported, "updated": updated, "skipped": skipped},
    )
    payload = {
        "id": str(batch.id),
        "divisionId": str(division_id),
        "tournamentId": str(division.tournament_id),
        "organizationId": str(org_id),
    }
    await emit_event(
        session, aggregate="import", event_type=events.IMPORT_COMMITTED, payload=payload
    )
    await get_broadcaster().publish(org_channel(org_id), events.RT_IMPORT_COMMITTED, payload)
    return batch


def _registration_from_row(
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    division_id: uuid.UUID,
    row: _EvaluatedRow,
    *,
    auto_approve: bool = False,
) -> Registration:
    reg = Registration(
        organization_id=org_id,
        division_id=division_id,
        submitted_by=actor_id,  # imported on the entrant's behalf by the organizer
        status=(
            RegistrationStatus.APPROVED.value
            if auto_approve
            else RegistrationStatus.SUBMITTED.value
        ),
        form_response={"_organizer_import": True},
    )
    _apply_row(reg, row)
    return reg


def _apply_row(reg: Registration, row: _EvaluatedRow) -> None:
    form = dict(reg.form_response or {})
    form["name"] = row.values.get("name")
    if row.values.get("email"):
        form["email"] = row.values["email"]
    if row.values.get("preferredPartnerName"):
        form["preferredPartnerName"] = row.values["preferredPartnerName"]
    reg.form_response = form
    if row.values.get("skillLevel"):
        reg.skill_level = row.values["skillLevel"]


# ---- mapping templates ----


async def list_templates(
    session: AsyncSession, org_id: uuid.UUID, source: str | None
) -> list[MappingTemplateView]:
    rows = await repo.list_mapping_templates(session, org_id, source)
    return [template_view(t) for t in rows]


async def save_template(
    session: AsyncSession, *, org_id: uuid.UUID, name: str, source: str, mapping: dict[str, str]
) -> MappingTemplate:
    existing = await repo.get_mapping_template_by_name(session, org_id, name)
    if existing is not None:
        existing.source = source
        existing.mapping = mapping
        await session.flush()
        return existing
    template = MappingTemplate(organization_id=org_id, name=name, source=source, mapping=mapping)
    session.add(template)
    await session.flush()
    return template


async def delete_template(
    session: AsyncSession, *, org_id: uuid.UUID, template_id: uuid.UUID
) -> None:
    template = await repo.get_mapping_template(session, org_id, template_id)
    if template is None:
        raise NotFoundError("Mapping template not found")
    await session.delete(template)
    await session.flush()


def template_view(t: MappingTemplate) -> MappingTemplateView:
    return MappingTemplateView(
        id=t.id,
        name=t.name,
        source=t.source,
        mapping=dict(t.mapping or {}),
        created_at=t.created_at,
    )


async def _require_division(
    session: AsyncSession, org_id: uuid.UUID, division_id: uuid.UUID
) -> Division:
    division = await repo.get_division(session, org_id, division_id)
    if division is None:
        raise NotFoundError("Division not found")
    return division
