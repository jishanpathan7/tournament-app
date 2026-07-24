import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as api from "@/features/franchise-ties/franchise-ties-api";
import { queryKeys } from "@/lib/query-keys";

const ftKeys = queryKeys.franchiseTies;

export function useFranchiseStandings(stageId: string | undefined) {
  return useQuery({
    queryKey: ftKeys.standings(stageId ?? ""),
    queryFn: () => api.getFranchiseStandings(stageId!),
    enabled: !!stageId,
  });
}

export function useFranchiseTiesBoard(stageId: string | undefined) {
  return useQuery({
    queryKey: ftKeys.board(stageId ?? ""),
    queryFn: () => api.getFranchiseTiesBoard(stageId!),
    enabled: !!stageId,
  });
}

/** Pre-flight tier-alignment check — do all teams share one pair-strength shape? */
export function usePairingTierCheck(stageId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ftKeys.tierCheck(stageId ?? ""),
    queryFn: () => api.getPairingTierCheck(stageId!),
    enabled: !!stageId && enabled,
    staleTime: 0,
  });
}

export function useGenerateFranchiseDraw(stageId: string, tournamentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (gamesPerTie?: number) => api.generateFranchiseDraw(stageId, gamesPerTie),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ftKeys.board(stageId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.matches(tournamentId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.stages(tournamentId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.schedule.queue(tournamentId) });
    },
  });
}

export function useGenerateFranchiseKnockoutDraw(
  stageId: string,
  tournamentId: string,
  sourceStageId?: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (advanceCount?: number) =>
      api.generateFranchiseKnockoutDraw(stageId, { sourceStageId, advanceCount }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ftKeys.board(stageId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.matches(tournamentId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.stages(tournamentId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.schedule.queue(tournamentId) });
    },
  });
}
