/** A deliberately separate key namespace from `@/lib/query-keys` — the public
 * microsite's cache never mixes with the authenticated console's, so an anonymous
 * visitor's query client and an organizer's can never cross-invalidate. */
export const publicQueryKeys = {
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
  search: (query: string) => ["public", "search", query] as const,
} as const;
