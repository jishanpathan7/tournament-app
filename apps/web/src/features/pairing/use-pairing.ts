"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  GeneratePairingRequest,
  SwapMembersRequest,
  UpdateProposedTeamRequest,
} from "@tournament/api-client";

import * as pairingApi from "@/features/pairing/pairing-api";
import { queryKeys } from "@/lib/query-keys";

/** The current draft pairing run for a division (or a specific squad within it). */
export function usePairing(
  divisionId: string,
  options?: { enabled?: boolean; squadId?: string },
) {
  const squadId = options?.squadId;
  return useQuery({
    queryKey: queryKeys.divisions.pairing(divisionId, squadId),
    queryFn: () => pairingApi.getPairing(divisionId, squadId),
    enabled: options?.enabled ?? true,
  });
}

/** Generate (or regenerate) pairing for a division, optionally scoped to one squad. */
export function useGeneratePairing(divisionId: string, squadId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: GeneratePairingRequest) =>
      pairingApi.generatePairing(divisionId, { ...body, squadId }),
    onSuccess: (run) => {
      queryClient.setQueryData(queryKeys.divisions.pairing(divisionId, squadId), run);
    },
  });
}

/** Lock/unlock or rename a proposed team; refetches the run to reflect the change. */
export function useUpdateProposedTeam(divisionId: string, squadId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { teamId: string; body: UpdateProposedTeamRequest }) =>
      pairingApi.updateProposedTeam(vars.teamId, vars.body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.divisions.pairing(divisionId, squadId),
      });
    },
  });
}

/** Swap two members across teams (manual override); seeds the re-scored run. */
export function useSwapMembers(divisionId: string, runId: string, squadId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SwapMembersRequest) => pairingApi.swapMembers(runId, body),
    onSuccess: (run) => {
      queryClient.setQueryData(queryKeys.divisions.pairing(divisionId, squadId), run);
    },
  });
}

/** Publish the draft → real pair participants. Invalidates the run + the division's
 * participant list (which the draw step reads). */
export function usePublishPairing(divisionId: string, tournamentId: string, squadId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => pairingApi.publishPairing(runId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.divisions.pairing(divisionId, squadId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.divisions.participants(divisionId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tournaments.participants(tournamentId),
      });
    },
  });
}
