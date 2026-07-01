"""Data access for the files module. Queries run under the request's org context,
so Row-Level Security scopes every row to the active organization automatically."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import File


async def get_file(session: AsyncSession, file_id: uuid.UUID) -> File | None:
    return await session.get(File, file_id)
