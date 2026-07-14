import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as api from "@/features/franchise-ties/franchise-ties-api";
import { queryKeys } from "@/lib/query-keys";

export function useFranchiseStandings(stageId: string | undefined) {
  return useQuery({
    queryKey: ["franchise-standings", stageId],
    queryFn: () => api.getFranchiseStandings(stageId!),
    enabled: !!stageId,
  });
}

export function useFranchiseTiesBoard(stageId: string | undefined) {
  return useQuery({
    queryKey: ["franchise-ties", stageId],
    queryFn: () => api.getFranchiseTiesBoard(stageId!),
    enabled: !!stageId,
  });
}

export function useGenerateFranchiseDraw(stageId: string, tournamentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (gamesPerTie?: number) => api.generateFranchiseDraw(stageId, gamesPerTie),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["franchise-ties", stageId] });
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
      void queryClient.invalidateQueries({ queryKey: ["franchise-ties", stageId] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.matches(tournamentId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.stages(tournamentId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.schedule.queue(tournamentId) });
    },
  });
}
