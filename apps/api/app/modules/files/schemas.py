"""Request/response schemas for the files module (all camelCase on the wire)."""

from __future__ import annotations

import datetime
import uuid
from typing import Any

from pydantic import Field

from app.api.schemas import ApiModel
from app.db.enums import FileKind


class PresignUploadRequest(ApiModel):
    kind: FileKind
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=1, max_length=160)
    size: int = Field(ge=0)


class UploadTarget(ApiModel):
    """Where and how the client uploads the bytes directly (presigned)."""

    url: str
    method: str
    headers: dict[str, str]
    max_size: int
    expires_in: int


class PresignUploadResponse(ApiModel):
    file_id: uuid.UUID
    storage_key: str
    upload: UploadTarget


class FileResource(ApiModel):
    id: uuid.UUID
    kind: FileKind
    content_type: str
    size: int
    status: str  # FileStatus value: pending | ready | failed
    visibility: str  # "public" | "private"
    url: str | None  # download URL (public_url or short-lived presigned GET); None until ready
    metadata: dict[str, Any] | None
    created_at: datetime.datetime
