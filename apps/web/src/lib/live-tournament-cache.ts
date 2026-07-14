import type { MatchView } from "@tournament/api-client";
import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

/** Console-side scope for anything that changes live tournament / match state. */
export interface LiveMatchScope {
  tournamentId: string;
  matchId?: string;
  stageId?: string;
}

export interface LiveCacheInvalidation {
  tournament?: boolean;
  queue?: boolean;
  activity?: boolean;
  stageMatches?: boolean;
  standings?: boolean;
  matchDetail?: boolean;
  bracketMeta?: boolean;
  notifications?: boolean;
}

/** Patch the authoritative match row into every list cache that mirrors tournament state. */
export function patchMatchInCaches(
  queryClient: QueryClient,
  match: MatchView,
  tournamentId: string,
): void {
  queryClient.setQueryData(queryKeys.matches.detail(match.id), match);

  queryClient.setQueryData<MatchView[]>(queryKeys.tournaments.matches(tournamentId), (prev) =>
    prev ? prev.map((m) => (m.id === match.id ? match : m)) : prev,
  );

  queryClient.setQueryData<MatchView[]>(queryKeys.stages.matches(match.stageId), (prev) =>
    prev ? prev.map((m) => (m.id === match.id ? match : m)) : prev,
  );
}

/**
 * Invalidate every console query key derived from live match / court / progress state.
 * Mutations should patch first (instant UI), then invalidate (cross-surface sync).
 */
export function invalidateLiveTournamentCaches(
  queryClient: QueryClient,
  scope: LiveMatchScope,
  flags: LiveCacheInvalidation = {},
): void {
  const {
    tournament = true,
    queue = true,
    activity = false,
    stageMatches = !!scope.stageId,
    standings = false,
    matchDetail = !!scope.matchId,
    bracketMeta = false,
    notifications = false,
  } = flags;

  if (scope.matchId && matchDetail) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.matches.detail(scope.matchId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.matches.events(scope.matchId) });
  }
  if (tournament) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.tournaments.matches(scope.tournamentId),
    });
  }
  if (queue) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.schedule.queue(scope.tournamentId),
    });
  }
  if (activity) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.tournaments.activity(scope.tournamentId),
    });
  }
  if (scope.stageId && stageMatches) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.stages.matches(scope.stageId) });
  }
  if (scope.stageId && standings) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.stages.standings(scope.stageId) });
  }
  if (bracketMeta) {
    void queryClient.invalidateQueries({ queryKey: ["matches"] });
    void queryClient.invalidateQueries({ queryKey: ["stages"] });
    void queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === "divisions" && query.queryKey[2] === "stages",
    });
  }
  if (notifications) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
  }
}

/** Local mutation success — patch lists, then sweep dependent caches. */
export function reconcileMatchInCaches(
  queryClient: QueryClient,
  match: MatchView,
  tournamentId: string,
  kind: "started" | "scored" | "scheduled",
): void {
  patchMatchInCaches(queryClient, match, tournamentId);

  const scope: LiveMatchScope = {
    tournamentId,
    matchId: match.id,
    stageId: match.stageId,
  };

  if (kind === "started") {
    invalidateLiveTournamentCaches(queryClient, scope, { activity: true });
    return;
  }

  if (kind === "scored") {
    invalidateLiveTournamentCaches(queryClient, scope, {
      activity: true,
      standings: true,
      notifications: true,
      bracketMeta: true,
    });
    return;
  }

  invalidateLiveTournamentCaches(queryClient, scope, {
    stageMatches: false,
    standings: false,
  });
}

function scopeFromEvent(data: Record<string, unknown>): LiveMatchScope | null {
  if (typeof data.tournamentId !== "string") return null;
  return {
    tournamentId: data.tournamentId,
    matchId: typeof data.matchId === "string" ? data.matchId : undefined,
    stageId: typeof data.stageId === "string" ? data.stageId : undefined,
  };
}

/** Realtime: match.started */
export function invalidateFromMatchStartedEvent(
  queryClient: QueryClient,
  data: Record<string, unknown>,
): void {
  const scope = scopeFromEvent(data);
  if (!scope) return;
  invalidateLiveTournamentCaches(queryClient, scope, { activity: true });
}

/** Realtime: match.completed (terminal score / correction) — remote clients only.
 * Local client already swept bracketMeta via reconcileMatchInCaches on mutation success. */
export function invalidateFromMatchCompletedEvent(
  queryClient: QueryClient,
  data: Record<string, unknown>,
): void {
  const scope = scopeFromEvent(data);
  if (!scope) return;
  invalidateLiveTournamentCaches(queryClient, scope, {
    activity: true,
    standings: true,
    notifications: true,
  });
}

/** Realtime: bracket.updated — remote clients only. */
export function invalidateFromBracketUpdatedEvent(
  queryClient: QueryClient,
  data: Record<string, unknown>,
): void {
  const scope = scopeFromEvent(data);
  if (!scope) return;
  invalidateLiveTournamentCaches(queryClient, scope, {
    activity: true,
  });
}

/** Realtime: schedule.updated */
export function invalidateFromScheduleUpdatedEvent(
  queryClient: QueryClient,
  data: Record<string, unknown>,
): void {
  const scope = scopeFromEvent(data);
  if (!scope) return;
  invalidateLiveTournamentCaches(queryClient, scope, { stageMatches: false, standings: false });
}

/** Realtime: standings.updated */
export function invalidateFromStandingsUpdatedEvent(
  queryClient: QueryClient,
  data: Record<string, unknown>,
): void {
  if (typeof data.stageId !== "string") return;
  void queryClient.invalidateQueries({ queryKey: queryKeys.stages.standings(data.stageId) });
}
