"""Registration Operations HTTP endpoints — imports, attendance/check-in, readiness.

All mutations are guarded by ``tournament:update`` + CSRF (organizer setup/event-day
actions); reads are org-scoped (RLS + repo). Import preview/detect are non-mutating but
organizer-only, so they use the same permission on a plain (non-CSRF) POST.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    Principal,
    authed_csrf,
    get_principal,
    get_request_session,
    require_permission,
)
from app.core import authz
from app.modules.registration_ops import checkin_service, import_service, readiness_service
from app.modules.registration_ops.schemas import (
    BulkCheckInRequest,
    BulkCheckInResult,
    CheckInRequest,
    DetectColumnsRequest,
    DetectColumnsResponse,
    ImportPreview,
    ImportRequest,
    ImportResult,
    ImportSourceInfo,
    MappingTemplateView,
    ParticipantAttendanceView,
    SaveMappingTemplateRequest,
    TournamentReadinessView,
)

router = APIRouter(tags=["registration-ops"])

_manage = require_permission(authz.TOURNAMENT_UPDATE)


# ---- imports ----


@router.get("/imports/sources", response_model=list[ImportSourceInfo])
async def list_import_sources(
    _principal: Principal = Depends(_manage),
) -> list[ImportSourceInfo]:
    return import_service.list_source_info()


@router.post("/imports/detect", response_model=DetectColumnsResponse)
async def detect_columns(
    body: DetectColumnsRequest,
    _principal: Principal = Depends(_manage),
) -> DetectColumnsResponse:
    columns, sample = import_service.detect_columns(body.source, body.raw)
    return DetectColumnsResponse(columns=columns, sample_rows=sample)


@router.post("/divisions/{division_id}/imports/preview", response_model=ImportPreview)
async def preview_import(
    division_id: uuid.UUID,
    body: ImportRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> ImportPreview:
    return await import_service.preview(
        session,
        org_id=principal.organization_id,
        division_id=division_id,
        source=body.source,
        raw=body.raw,
        mapping=body.mapping,
        update_existing=body.update_existing,
    )


@router.post(
    "/divisions/{division_id}/imports/commit",
    response_model=ImportResult,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(authed_csrf)],
)
async def commit_import(
    division_id: uuid.UUID,
    body: ImportRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> ImportResult:
    batch = await import_service.commit(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        division_id=division_id,
        source=body.source,
        raw=body.raw,
        mapping=body.mapping,
        update_existing=body.update_existing,
    )
    return ImportResult(
        batch_id=batch.id,
        imported=batch.imported_count,
        updated=batch.updated_count,
        skipped=batch.skipped_count,
    )


@router.get("/imports/mapping-templates", response_model=list[MappingTemplateView])
async def list_mapping_templates(
    source: str | None = None,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> list[MappingTemplateView]:
    return await import_service.list_templates(session, principal.organization_id, source)


@router.post(
    "/imports/mapping-templates",
    response_model=MappingTemplateView,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(authed_csrf)],
)
async def save_mapping_template(
    body: SaveMappingTemplateRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> MappingTemplateView:
    template = await import_service.save_template(
        session,
        org_id=principal.organization_id,
        name=body.name,
        source=body.source,
        mapping=body.mapping,
    )
    return import_service.template_view(template)


@router.delete(
    "/imports/mapping-templates/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(authed_csrf)],
)
async def delete_mapping_template(
    template_id: uuid.UUID,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> None:
    await import_service.delete_template(
        session, org_id=principal.organization_id, template_id=template_id
    )


# ---- attendance / check-in ----


@router.get("/divisions/{division_id}/attendance", response_model=list[ParticipantAttendanceView])
async def list_attendance(
    division_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> list[ParticipantAttendanceView]:
    rows = await checkin_service.list_attendance(session, principal.organization_id, division_id)
    return [checkin_service.build_attendance_view(p) for p in rows]


@router.post(
    "/participants/{participant_id}/attendance",
    response_model=ParticipantAttendanceView,
    dependencies=[Depends(authed_csrf)],
)
async def set_attendance(
    participant_id: uuid.UUID,
    body: CheckInRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> ParticipantAttendanceView:
    participant = await checkin_service.set_attendance(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        participant_id=participant_id,
        status=body.status,
    )
    return checkin_service.build_attendance_view(participant)


@router.post(
    "/divisions/{division_id}/attendance/bulk",
    response_model=BulkCheckInResult,
    dependencies=[Depends(authed_csrf)],
)
async def bulk_set_attendance(
    division_id: uuid.UUID,
    body: BulkCheckInRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> BulkCheckInResult:
    updated = await checkin_service.bulk_set_attendance(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        participant_ids=body.participant_ids,
        status=body.status,
    )
    return BulkCheckInResult(updated=updated, attendance=body.status)


# ---- readiness ----


@router.get("/tournaments/{tournament_id}/readiness", response_model=TournamentReadinessView)
async def get_readiness(
    tournament_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> TournamentReadinessView:
    return await readiness_service.tournament_readiness(
        session, principal.organization_id, tournament_id
    )
