import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as api from "@/features/franchise-ties/franchise-ties-api";

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
      void queryClient.invalidateQueries({ queryKey: ["tournaments", tournamentId] });
      void queryClient.invalidateQueries({ queryKey: ["matches"] });
      void queryClient.invalidateQueries({ queryKey: ["standings"] });
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
      void queryClient.invalidateQueries({ queryKey: ["tournaments", tournamentId] });
      void queryClient.invalidateQueries({ queryKey: ["matches"] });
      void queryClient.invalidateQueries({ queryKey: ["standings"] });
    },
  });
}
