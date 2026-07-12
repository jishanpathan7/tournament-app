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

  // Public microsite keys live under a "public" prefix so they never cross-invalidate
  // with the authenticated console's cache (they run in separate QueryClient instances).
  public: {
    tournament: (slug: string) => ["public", "tournament", slug] as const,
    divisions: (slug: string) => ["public", "tournament", slug, "divisions"] as const,
    stages: (slug: string) => ["public", "tournament", slug, "stages"] as const,
    participants: (slug: string) => ["public", "tournament", slug, "participants"] as const,
    participant: (slug: string, participantId: string) =>
      ["public", "tournament", slug, "participants", participantId] as const,
    matches: (slug: string) => ["public", "tournament", slug, "matches"] as const,
    match: (slug: string, matchId: string) =>
      ["public", "tournament", slug, "matches", matchId] as const,
    matchEvents: (slug: string, matchId: string) =>
      ["public", "tournament", slug, "matches", matchId, "events"] as const,
    standings: (slug: string, stageId: string) =>
      ["public", "tournament", slug, "stages", stageId, "standings"] as const,
    courts: (slug: string) => ["public", "tournament", slug, "courts"] as const,
    playerStats: (slug: string) => ["public", "tournament", slug, "player-stats"] as const,
    search: (query: string) => ["public", "search", query] as const,
  },
} as const;
