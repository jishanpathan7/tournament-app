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
    matches: (tournamentId: string) => ["tournaments", tournamentId, "matches"] as const,
    activity: (tournamentId: string) => ["tournaments", tournamentId, "activity"] as const,
    participants: (tournamentId: string) => ["tournaments", tournamentId, "participants"] as const,
    stages: (tournamentId: string) => ["tournaments", tournamentId, "all-stages"] as const,
  },

  divisions: {
    stages: (divisionId: string) => ["divisions", divisionId, "stages"] as const,
    registrations: (divisionId: string) => ["divisions", divisionId, "registrations"] as const,
    participants: (divisionId: string) => ["divisions", divisionId, "participants"] as const,
    pairing: (divisionId: string, squadId?: string) =>
      squadId
        ? (["divisions", divisionId, "pairing", squadId] as const)
        : (["divisions", divisionId, "pairing"] as const),
  },

  stages: {
    matches: (stageId: string) => ["stages", stageId, "matches"] as const,
    standings: (stageId: string) => ["stages", stageId, "standings"] as const,
  },

  matches: {
    detail: (id: string) => ["matches", "detail", id] as const,
    events: (id: string) => ["matches", "detail", id, "events"] as const,
  },

  teams: {
    detail: (id: string) => ["teams", "detail", id] as const,
  },

  courts: {
    all: ["courts"] as const,
    venues: () => ["courts", "venues"] as const,
    list: () => ["courts", "list"] as const,
    tournament: (tournamentId: string) => ["courts", "tournament", tournamentId] as const,
  },

  schedule: {
    queue: (tournamentId: string) => ["schedule", tournamentId, "queue"] as const,
  },

  notifications: {
    all: ["notifications"] as const,
    list: (unreadOnly = false) => ["notifications", "list", { unreadOnly }] as const,
    unreadCount: () => ["notifications", "unread-count"] as const,
    actionRequired: () => ["notifications", "action-required"] as const,
  },

  flags: {
    all: ["feature-flags"] as const,
    list: () => ["feature-flags", "list"] as const,
    enabled: (key: string) => ["feature-flags", "enabled", key] as const,
  },

  imports: {
    sources: () => ["imports", "sources"] as const,
    templates: (source?: string) => ["imports", "templates", source ?? "all"] as const,
  },

  attendance: {
    division: (divisionId: string) => ["attendance", divisionId] as const,
  },

  readiness: {
    tournament: (tournamentId: string) => ["readiness", tournamentId] as const,
  },

  health: ["health"] as const,

  tournamentMembers: {
    list: (tournamentId: string) => ["tournament-members", tournamentId] as const,
  },
} as const;
