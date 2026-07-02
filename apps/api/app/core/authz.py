"""Authorization policy — pure, role-based now, resource-ready.

No DB, no FastAPI. ``app/api/deps.py:require_permission`` calls ``can()``; routers
never embed authz logic. Default-deny: an unknown role or action yields False.
The ``resource`` parameter is the seam for resource-level checks (e.g. a
scorekeeper only on assigned matches) — unused until the scoring module.
"""

from __future__ import annotations

from app.db.enums import OrgRole

# Actions are "resource:verb" strings. tournament:* / scoring:* are forward-declared
# for the modules that follow, so the matrix is complete when they land.
ORG_READ = "org:read"
ORG_UPDATE = "org:update"
ORG_DELETE = "org:delete"
MEMBER_READ = "member:read"
MEMBER_INVITE = "member:invite"
MEMBER_ROLE_UPDATE = "member:role:update"
MEMBER_REMOVE = "member:remove"
TOURNAMENT_CREATE = "tournament:create"
TOURNAMENT_UPDATE = "tournament:update"
TOURNAMENT_DELETE = "tournament:delete"
SCORING_WRITE = "scoring:write"
SCHEDULE_MANAGE = "schedule:manage"
FILE_READ = "file:read"
FILE_WRITE = "file:write"
FEATURE_FLAG_MANAGE = "feature_flag:manage"

ALL_ACTIONS: frozenset[str] = frozenset(
    {
        ORG_READ,
        ORG_UPDATE,
        ORG_DELETE,
        MEMBER_READ,
        MEMBER_INVITE,
        MEMBER_ROLE_UPDATE,
        MEMBER_REMOVE,
        TOURNAMENT_CREATE,
        TOURNAMENT_UPDATE,
        TOURNAMENT_DELETE,
        SCORING_WRITE,
        SCHEDULE_MANAGE,
        FILE_READ,
        FILE_WRITE,
        FEATURE_FLAG_MANAGE,
    }
)

ROLE_PERMISSIONS: dict[OrgRole, frozenset[str]] = {
    OrgRole.OWNER: ALL_ACTIONS,
    OrgRole.ADMIN: ALL_ACTIONS - {ORG_DELETE},
    OrgRole.ORGANIZER: frozenset(
        {
            ORG_READ,
            MEMBER_READ,
            TOURNAMENT_CREATE,
            TOURNAMENT_UPDATE,
            TOURNAMENT_DELETE,
            SCORING_WRITE,
            SCHEDULE_MANAGE,
            FILE_READ,
            FILE_WRITE,
        }
    ),
    OrgRole.SCOREKEEPER: frozenset({ORG_READ, MEMBER_READ, SCORING_WRITE, FILE_READ}),
    OrgRole.VIEWER: frozenset({ORG_READ, MEMBER_READ, FILE_READ}),
}


def can(role: OrgRole | str, action: str, resource: object | None = None) -> bool:
    """Return True if `role` is permitted `action`. Default-deny."""
    try:
        role_enum = role if isinstance(role, OrgRole) else OrgRole(role)
    except ValueError:
        return False
    return action in ROLE_PERMISSIONS.get(role_enum, frozenset())
