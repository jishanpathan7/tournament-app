"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  GeneratePairingRequest,
  SwapMembersRequest,
  UpdateProposedTeamRequest,
} from "@tournament/api-client";

import * as pairingApi from "@/features/pairing/pairing-api";
import { queryKeys } from "@/lib/query-keys";

/** The current draft pairing run for a division (or null before one is generated). */
export function usePairing(divisionId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.divisions.pairing(divisionId),
    queryFn: () => pairingApi.getPairing(divisionId),
    enabled: options?.enabled ?? true,
  });
}

/** Generate (or regenerate) the division's teams. Seeds the returned run into cache. */
export function useGeneratePairing(divisionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: GeneratePairingRequest) => pairingApi.generatePairing(divisionId, body),
    onSuccess: (run) => {
      queryClient.setQueryData(queryKeys.divisions.pairing(divisionId), run);
    },
  });
}

/** Lock/unlock or rename a proposed team; refetches the run to reflect the change. */
export function useUpdateProposedTeam(divisionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { teamId: string; body: UpdateProposedTeamRequest }) =>
      pairingApi.updateProposedTeam(vars.teamId, vars.body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.divisions.pairing(divisionId) });
    },
  });
}

/** Swap two members across teams (manual override); seeds the re-scored run. */
export function useSwapMembers(divisionId: string, runId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SwapMembersRequest) => pairingApi.swapMembers(runId, body),
    onSuccess: (run) => {
      queryClient.setQueryData(queryKeys.divisions.pairing(divisionId), run);
    },
  });
}

/** Publish the draft → real pair participants. Invalidates the run + the division's
 * participant list (which the draw step reads). */
export function usePublishPairing(divisionId: string, tournamentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => pairingApi.publishPairing(runId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.divisions.pairing(divisionId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.divisions.participants(divisionId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tournaments.participants(tournamentId),
      });
    },
  });
}
