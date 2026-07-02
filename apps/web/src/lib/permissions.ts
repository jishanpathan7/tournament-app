/**
 * Client-side authorization mirror of the backend policy (`app/core/authz.py`).
 *
 * This gates UI affordances only — the server is the source of truth and re-checks
 * every mutation. Keep `ROLE_PERMISSIONS` byte-for-byte aligned with the backend;
 * default-deny on unknown role/action, exactly like `authz.can`.
 */
import type { OrgRole } from "@tournament/api-client";

export const ACTIONS = {
  ORG_READ: "org:read",
  ORG_UPDATE: "org:update",
  ORG_DELETE: "org:delete",
  MEMBER_READ: "member:read",
  MEMBER_INVITE: "member:invite",
  MEMBER_ROLE_UPDATE: "member:role:update",
  MEMBER_REMOVE: "member:remove",
  TOURNAMENT_CREATE: "tournament:create",
  TOURNAMENT_UPDATE: "tournament:update",
  TOURNAMENT_DELETE: "tournament:delete",
  SCORING_WRITE: "scoring:write",
  SCHEDULE_MANAGE: "schedule:manage",
  FILE_READ: "file:read",
  FILE_WRITE: "file:write",
  FEATURE_FLAG_MANAGE: "feature_flag:manage",
} as const;

export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];

const ALL: readonly Action[] = Object.values(ACTIONS);

/** Mirrors `ROLE_PERMISSIONS` in the backend policy. */
export const ROLE_PERMISSIONS: Record<OrgRole, ReadonlySet<Action>> = {
  owner: new Set(ALL),
  admin: new Set(ALL.filter((a) => a !== ACTIONS.ORG_DELETE)),
  organizer: new Set<Action>([
    ACTIONS.ORG_READ,
    ACTIONS.MEMBER_READ,
    ACTIONS.TOURNAMENT_CREATE,
    ACTIONS.TOURNAMENT_UPDATE,
    ACTIONS.TOURNAMENT_DELETE,
    ACTIONS.SCORING_WRITE,
    ACTIONS.SCHEDULE_MANAGE,
    ACTIONS.FILE_READ,
    ACTIONS.FILE_WRITE,
  ]),
  scorekeeper: new Set<Action>([
    ACTIONS.ORG_READ,
    ACTIONS.MEMBER_READ,
    ACTIONS.SCORING_WRITE,
    ACTIONS.FILE_READ,
  ]),
  viewer: new Set<Action>([ACTIONS.ORG_READ, ACTIONS.MEMBER_READ, ACTIONS.FILE_READ]),
};

/** True if `role` may perform `action`. Default-deny (null role → false). */
export function can(role: OrgRole | null | undefined, action: Action): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.has(action) ?? false;
}
