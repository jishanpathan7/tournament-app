"""Audit logging helper — one place to append an ``audit_logs`` row.

Records a security/administrative action on the caller's request session so it
commits in the same transaction as the change. ``audit_logs`` is org-scoped (RLS);
call inside a request/org-scoped transaction. Modules use this instead of hand-rolling
``AuditLog`` inserts so the audit trail stays uniform.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuditLog


def record(
    session: AsyncSession,
    *,
    organization_id: uuid.UUID,
    actor_id: uuid.UUID | None,
    action: str,
    entity: str,
    entity_id: uuid.UUID,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
) -> None:
    session.add(
        AuditLog(
            organization_id=organization_id,
            actor_id=actor_id,
            action=action,
            entity=entity,
            entity_id=entity_id,
            before=before,
            after=after,
        )
    )
