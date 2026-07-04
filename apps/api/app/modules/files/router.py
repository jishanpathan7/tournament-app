"""File HTTP endpoints.

Public API: presign an upload, confirm it, fetch (metadata + download URL), delete.
All are tenant-scoped via ``get_request_session`` (RLS) and guarded by the pure
authz policy (``file:read`` / ``file:write``) — never authz logic in the router.

Dev-only sinks: ``PUT/GET /files/local/{key}`` back the LocalStorage backend when
no R2 is configured. They carry no session — access is authorized by the HMAC
signature baked into the presigned URL — and 404 whenever R2 is the backend.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Principal, authed_csrf, get_request_session, require_permission
from app.api.errors import NotFoundError, PermissionDeniedError, ValidationError
from app.core import authz
from app.core.config import get_settings
from app.core.factory import get_storage
from app.core.ports import Storage
from app.db.enums import FileKind
from app.db.models import File
from app.modules.files import service
from app.modules.files.schemas import (
    FileResource,
    PresignUploadRequest,
    PresignUploadResponse,
    UploadTarget,
)
from app.storage import policy
from app.storage.local import LocalStorage, verify_signature

router = APIRouter(prefix="/files", tags=["files"])


def _resource(row: File, url: str | None) -> FileResource:
    return FileResource(
        id=row.id,
        kind=FileKind(row.kind),
        content_type=row.content_type,
        size=row.size,
        status=row.status,
        visibility="public" if policy.is_public(FileKind(row.kind)) else "private",
        url=url,
        metadata=row.meta,
        created_at=row.created_at,
    )


def _require_local_backend() -> None:
    if get_settings().storage_backend != "local":
        raise NotFoundError("Not found")


# ---- dev-only local storage plane (declared before /{file_id} to match first) ----


@router.put("/local/{key:path}", include_in_schema=False)
async def local_upload(
    key: str,
    request: Request,
    expires: int,
    sig: str,
    storage: Storage = Depends(get_storage),
) -> Response:
    _require_local_backend()
    settings = get_settings()
    if not verify_signature(settings.effective_storage_signing_secret, "PUT", key, expires, sig):
        raise PermissionDeniedError("Invalid or expired upload signature", code="signature_invalid")
    data = await request.body()
    if len(data) > settings.storage_max_upload_size:
        raise ValidationError("File exceeds maximum upload size", code="file_too_large")
    assert isinstance(storage, LocalStorage)  # guaranteed by _require_local_backend
    storage.write(key, data)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/local/{key:path}", include_in_schema=False)
async def local_download(
    key: str,
    expires: int,
    sig: str,
    storage: Storage = Depends(get_storage),
) -> Response:
    _require_local_backend()
    settings = get_settings()
    if not verify_signature(settings.effective_storage_signing_secret, "GET", key, expires, sig):
        raise PermissionDeniedError(
            "Invalid or expired download signature", code="signature_invalid"
        )
    assert isinstance(storage, LocalStorage)
    data = await storage.read(key)
    if data is None:
        raise NotFoundError("File not found")
    return Response(content=data, media_type="application/octet-stream")


# ---- public API ----


@router.post(
    "",
    response_model=PresignUploadResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(authed_csrf)],
)
async def presign_upload(
    body: PresignUploadRequest,
    response: Response,
    principal: Principal = Depends(require_permission(authz.FILE_WRITE)),
    session: AsyncSession = Depends(get_request_session),
    storage: Storage = Depends(get_storage),
) -> PresignUploadResponse:
    row, upload = await service.create_upload(
        session,
        storage,
        org_id=principal.organization_id,
        owner_id=principal.user_id,
        kind=body.kind,
        filename=body.filename,
        content_type=body.content_type,
        size=body.size,
    )
    response.headers["Location"] = f"{get_settings().api_v1_prefix}/files/{row.id}"
    return PresignUploadResponse(
        file_id=row.id,
        storage_key=row.storage_key,
        upload=UploadTarget(
            url=upload["url"],
            method=upload["method"],
            headers=upload["headers"],
            max_size=upload["maxSize"],
            expires_in=upload["expiresIn"],
        ),
    )


@router.post(
    "/{file_id}/complete",
    response_model=FileResource,
    dependencies=[Depends(authed_csrf)],
)
async def complete_upload(
    file_id: uuid.UUID,
    principal: Principal = Depends(require_permission(authz.FILE_WRITE)),
    session: AsyncSession = Depends(get_request_session),
    storage: Storage = Depends(get_storage),
) -> FileResource:
    row = await service.complete_upload(session, storage, file_id=file_id)
    url = await service.resolve_url(storage, row, ttl=get_settings().storage_presign_ttl)
    return _resource(row, url)


@router.get("/{file_id}", response_model=FileResource)
async def get_file(
    file_id: uuid.UUID,
    principal: Principal = Depends(require_permission(authz.FILE_READ)),
    session: AsyncSession = Depends(get_request_session),
    storage: Storage = Depends(get_storage),
) -> FileResource:
    row, url = await service.get_download(
        session, storage, file_id=file_id, ttl=get_settings().storage_presign_ttl
    )
    return _resource(row, url)


@router.delete(
    "/{file_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(authed_csrf)],
)
async def delete_file(
    file_id: uuid.UUID,
    principal: Principal = Depends(require_permission(authz.FILE_WRITE)),
    session: AsyncSession = Depends(get_request_session),
    storage: Storage = Depends(get_storage),
) -> Response:
    await service.delete_file(session, storage, file_id=file_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
