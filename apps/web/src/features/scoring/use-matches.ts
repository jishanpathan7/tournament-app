"use client";

import { useQuery } from "@tanstack/react-query";

import * as scoringApi from "@/features/scoring/scoring-api";
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
