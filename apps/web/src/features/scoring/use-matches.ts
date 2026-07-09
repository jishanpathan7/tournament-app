"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as scoringApi from "@/features/scoring/scoring-api";
import { reconcileMatchInCaches } from "@/lib/live-tournament-cache";
import { queryKeys } from "@/lib/query-keys";

export function useStageMatches(stageId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.stages.matches(stageId),
    queryFn: () => scoringApi.listStageMatches(stageId),
    enabled: options?.enabled ?? true,
  });
}

export function useMatch(matchId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.matches.detail(matchId ?? ""),
    queryFn: () => scoringApi.getMatch(matchId!),
    enabled: !!matchId,
  });
}

export function useStandings(stageId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.stages.standings(stageId),
    queryFn: () => scoringApi.getStandings(stageId),
    enabled: options?.enabled ?? true,
  });
}

/** A match's append-only scoring/correction log — Match Detail's history panel. */
export function useMatchEvents(
  matchId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.matches.events(matchId ?? ""),
    queryFn: () => scoringApi.listMatchEvents(matchId!),
    enabled: (options?.enabled ?? true) && !!matchId,
  });
}

/**
 * Submits (or corrects) a match's result. The backend Sport Profile owns every rule —
 * this hook only transports the payload and reconciles caches on success: seeds the
 * fresh match view, and invalidates everything downstream that the score can change
 * (this stage's matches/standings, and the tournament-wide queue/activity feed that
 * back the Match Center). `tournamentId` is required purely for that last invalidation —
 * `MatchView` doesn't carry it.
 */
export function useScoreMatch(matchId: string, tournamentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { payload: Record<string, unknown>; ifMatch?: string | null }) =>
      scoringApi.scoreMatch(matchId, vars.payload, {
        ifMatch: vars.ifMatch,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (match) => {
      reconcileMatchInCaches(queryClient, match, tournamentId, "scored");
    },
  });
}
