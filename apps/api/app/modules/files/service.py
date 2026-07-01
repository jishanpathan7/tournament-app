"""Files use cases: presign upload → confirm/complete → download → delete.

Validation (MIME + size per kind) and visibility come from ``app.storage.policy``;
object I/O goes through the ``Storage`` port. The service never commits — the
request-scoped session dependency owns the transaction (and RLS org context).
"""

from __future__ import annotations

import re
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import NotFoundError, ValidationError
from app.core.events import emit_event
from app.core.ports import Storage
from app.db.enums import FileKind, FileStatus
from app.db.models import File
from app.db.types import uuid7
from app.modules.files import events as file_events
from app.modules.files import repository as repo
from app.storage import policy
from app.storage.images import probe_image

_IMAGE_PROBE_MAX = 8 * 1024 * 1024  # only download+probe images up to 8MB
_UNSAFE = re.compile(r"[^A-Za-z0-9._-]+")


def _safe_filename(name: str) -> str:
    base = name.strip().replace("\\", "/").split("/")[-1]
    cleaned = _UNSAFE.sub("-", base).strip("-.")
    return (cleaned or "file")[:120]


async def create_upload(
    session: AsyncSession,
    storage: Storage,
    *,
    org_id: uuid.UUID,
    owner_id: uuid.UUID,
    kind: FileKind,
    filename: str,
    content_type: str,
    size: int,
) -> tuple[File, dict]:
    """Validate against the kind policy, create a pending File, return a presigned PUT."""
    kind_policy = policy.policy_for(kind)
    if kind_policy is None:
        raise ValidationError(f"Unsupported file kind: {kind.value}")
    if content_type not in kind_policy.content_types:
        raise ValidationError(
            f"Content type '{content_type}' is not allowed for {kind.value}",
            code="content_type_not_allowed",
        )
    if size > kind_policy.max_size:
        raise ValidationError(
            f"File of {size} bytes exceeds the {kind_policy.max_size} byte limit for {kind.value}",
            code="file_too_large",
        )

    file_id = uuid7()
    storage_key = f"{org_id}/{kind.value}/{file_id}/{_safe_filename(filename)}"
    row = File(
        id=file_id,
        organization_id=org_id,
        owner_id=owner_id,
        kind=kind.value,
        storage_key=storage_key,
        content_type=content_type,
        size=size,
        status=FileStatus.PENDING.value,
    )
    session.add(row)
    await session.flush()
    upload = await storage.presign_put(storage_key, content_type, kind_policy.max_size)
    return row, upload


async def complete_upload(session: AsyncSession, storage: Storage, *, file_id: uuid.UUID) -> File:
    """Verify the object exists, enforce the size ceiling, probe image metadata, mark ready."""
    row = await repo.get_file(session, file_id)
    if row is None:
        raise NotFoundError("File not found")

    stat = await storage.stat(row.storage_key)
    if stat is None:
        row.status = FileStatus.FAILED.value
        raise ValidationError("Upload not found in storage", code="upload_incomplete")

    kind_policy = policy.policy_for(FileKind(row.kind))
    if kind_policy is not None and stat.size > kind_policy.max_size:
        row.status = FileStatus.FAILED.value
        raise ValidationError(
            f"Uploaded file of {stat.size} bytes exceeds the {kind_policy.max_size} byte limit",
            code="file_too_large",
        )

    row.size = stat.size
    if policy.is_image(row.content_type) and stat.size <= _IMAGE_PROBE_MAX:
        data = await storage.read(row.storage_key)
        if data is not None:
            meta = probe_image(data)
            if meta is not None:
                row.meta = meta
    row.status = FileStatus.READY.value
    await emit_event(
        session,
        aggregate=file_events.AGGREGATE,
        event_type=file_events.FILE_READY,
        payload={"fileId": str(row.id), "kind": row.kind},
    )
    await session.flush()
    return row


async def resolve_url(storage: Storage, row: File, *, ttl: int) -> str | None:
    """Public kinds get a durable public_url; private kinds a short-lived presigned
    GET. None until the upload is confirmed ready."""
    if row.status != FileStatus.READY.value:
        return None
    if policy.is_public(FileKind(row.kind)):
        return storage.public_url(row.storage_key)
    return await storage.presign_get(row.storage_key, ttl)


async def get_download(
    session: AsyncSession, storage: Storage, *, file_id: uuid.UUID, ttl: int
) -> tuple[File, str | None]:
    """Fetch the file row (RLS-scoped) and its download URL."""
    row = await repo.get_file(session, file_id)
    if row is None:
        raise NotFoundError("File not found")
    return row, await resolve_url(storage, row, ttl=ttl)


async def delete_file(session: AsyncSession, storage: Storage, *, file_id: uuid.UUID) -> None:
    row = await repo.get_file(session, file_id)
    if row is None:
        raise NotFoundError("File not found")
    await storage.delete(row.storage_key)
    await session.delete(row)
    await session.flush()
