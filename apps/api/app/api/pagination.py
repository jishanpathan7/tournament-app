"""Cursor (keyset) pagination over (created_at, id).

Opaque base64url cursor — never exposes offsets/ids as raw cursors. Generic
``CursorPage[T]`` response. Keyset (not OFFSET) so deep pages stay fast at scale.
All list endpoints should return ``CursorPage[T]`` and accept ``cursor_params``.
"""

from __future__ import annotations

import base64
import binascii
import datetime
import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Generic, TypeVar

from fastapi import Query
from sqlalchemy import Select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ValidationError
from app.api.schemas import ApiModel

T = TypeVar("T")

DEFAULT_LIMIT = 50
MAX_LIMIT = 100


@dataclass(frozen=True)
class CursorParams:
    cursor: str | None
    limit: int


def cursor_params(
    cursor: str | None = Query(default=None),
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
) -> CursorParams:
    return CursorParams(cursor=cursor, limit=limit)


class CursorPage(ApiModel, Generic[T]):
    items: list[T]
    next_cursor: str | None = None


def encode_cursor(created_at: datetime.datetime, id_: uuid.UUID) -> str:
    raw = f"{created_at.isoformat()}|{id_}".encode()
    return base64.urlsafe_b64encode(raw).decode()


def decode_cursor(cursor: str) -> tuple[datetime.datetime, uuid.UUID]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode()).decode()
        ts_str, id_str = raw.split("|", 1)
        return datetime.datetime.fromisoformat(ts_str), uuid.UUID(id_str)
    except (ValueError, binascii.Error) as exc:
        raise ValidationError("Invalid pagination cursor") from exc


async def cursor_page(
    session: AsyncSession,
    stmt: Select[Any],
    params: CursorParams,
    *,
    entity: Any,
) -> tuple[Sequence[Any], str | None]:
    """Apply keyset pagination to ``stmt``, ordered by (created_at, id) DESC.

    Returns ``(rows, next_cursor)``; the caller maps rows -> schema and builds the
    ``CursorPage``. ``entity`` is the mapped class (exposes ``created_at`` and ``id``
    — every table has both via the mixins). Fetches limit+1 to detect a next page.
    """
    if params.cursor is not None:
        created_at, id_ = decode_cursor(params.cursor)
        stmt = stmt.where(tuple_(entity.created_at, entity.id) < (created_at, id_))
    stmt = stmt.order_by(entity.created_at.desc(), entity.id.desc()).limit(params.limit + 1)
    rows = list((await session.execute(stmt)).scalars().all())
    next_cursor: str | None = None
    if len(rows) > params.limit:
        last = rows[params.limit - 1]
        next_cursor = encode_cursor(last.created_at, last.id)
        rows = rows[: params.limit]
    return rows, next_cursor
