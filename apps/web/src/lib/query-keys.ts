/**
 * Central query-key factory — one source of truth so hooks and cache invalidation
 * (including realtime) never drift on key shape. Keys are hierarchical: invalidating
 * a parent (`tournaments.all`) sweeps its children.
 */
export const queryKeys = {
  session: ["session"] as const,

  orgs: {
    all: ["orgs"] as const,
    list: () => ["orgs", "list"] as const,
    active: () => ["orgs", "active"] as const,
    members: () => ["orgs", "active", "members"] as const,
    invites: () => ["orgs", "active", "invites"] as const,
  },

  tournaments: {
    all: ["tournaments"] as const,
    list: () => ["tournaments", "list"] as const,
    detail: (id: string) => ["tournaments", "detail", id] as const,
    divisions: (tournamentId: string) => ["tournaments", tournamentId, "divisions"] as const,
  },

  divisions: {
    stages: (divisionId: string) => ["divisions", divisionId, "stages"] as const,
    registrations: (divisionId: string) => ["divisions", divisionId, "registrations"] as const,
    participants: (divisionId: string) => ["divisions", divisionId, "participants"] as const,
  },

  stages: {
    matches: (stageId: string) => ["stages", stageId, "matches"] as const,
    standings: (stageId: string) => ["stages", stageId, "standings"] as const,
  },

  matches: {
    detail: (id: string) => ["matches", "detail", id] as const,
  },

  notifications: {
    all: ["notifications"] as const,
    list: (unreadOnly = false) => ["notifications", "list", { unreadOnly }] as const,
    unreadCount: () => ["notifications", "unread-count"] as const,
  },

  flags: {
    all: ["feature-flags"] as const,
    list: () => ["feature-flags", "list"] as const,
    enabled: (key: string) => ["feature-flags", "enabled", key] as const,
  },

  health: ["health"] as const,
} as const;
