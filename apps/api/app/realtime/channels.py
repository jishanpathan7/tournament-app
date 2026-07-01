"""Channel naming + subscription authorization.

Channels are scoped to what a caller may legitimately listen to: their active org
(``org:{id}``) and themselves (``user:{id}``). Future resource channels (e.g.
``tournament:{id}``) extend ``is_authorized`` with a resource-level check — the
same default-deny posture as the authz policy.
"""

from __future__ import annotations

import uuid


def org_channel(org_id: uuid.UUID) -> str:
    return f"org:{org_id}"


def user_channel(user_id: uuid.UUID) -> str:
    return f"user:{user_id}"


def is_authorized(channel: str, *, org_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    """Default-deny: only the caller's own org and user channels are allowed for now."""
    return channel in {org_channel(org_id), user_channel(user_id)}
