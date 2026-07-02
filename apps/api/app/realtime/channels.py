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


def tournament_channel(tournament_id: uuid.UUID) -> str:
    """Public microsite live updates — anonymous subscribers never go through
    `is_authorized` (there's no principal); the public router authorizes this one by
    re-checking the tournament's own visibility, the same gate every other public read
    uses. Kept as its own channel, not folded into `org_channel`, precisely so an
    anonymous subscriber can never see an org's other, non-public tournaments."""
    return f"tournament:{tournament_id}"


def is_authorized(channel: str, *, org_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    """Default-deny: only the caller's own org and user channels are allowed for now."""
    return channel in {org_channel(org_id), user_channel(user_id)}
