"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  GeneratePairingRequest,
  SwapMembersRequest,
  UpdateProposedTeamRequest,
} from "@tournament/api-client";

import * as pairingApi from "@/features/pairing/pairing-api";
import { queryKeys } from "@/lib/query-keys";

function invalidateDivisionPairing(
  queryClient: ReturnType<typeof useQueryClient>,
  divisionId: string,
) {
  void queryClient.invalidateQueries({
    queryKey: ["divisions", divisionId, "pairing"],
  });
}

function invalidatePairingParticipants(
  queryClient: ReturnType<typeof useQueryClient>,
  divisionId: string,
  tournamentId: string,
) {
  invalidateDivisionPairing(queryClient, divisionId);
  void queryClient.invalidateQueries({
    queryKey: queryKeys.divisions.participants(divisionId),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.tournaments.participants(tournamentId),
  });
}

/** Partner name warnings — unresolvable preferredPartnerName entries before pairing. */
export function usePartnerWarnings(divisionId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["divisions", divisionId, "partner-warnings"],
    queryFn: () => pairingApi.getPartnerWarnings(divisionId),
    enabled: options?.enabled ?? true,
  });
}

/** The current draft pairing run for a division (or a specific squad within it). */
export function usePairing(divisionId: string, options?: { enabled?: boolean; squadId?: string }) {
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
      invalidateDivisionPairing(queryClient, divisionId);
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
      invalidateDivisionPairing(queryClient, divisionId);
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
      invalidateDivisionPairing(queryClient, divisionId);
    },
  });
}

/** Resolve an odd-one-out player by choosing an existing player to play twice.
 * Seeds the updated run directly into the query cache. */
export function useAddDuplicatePair(divisionId: string, runId: string, squadId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { unpairedId: string; duplicateId: string }) =>
      pairingApi.addDuplicatePair(runId, body),
    onSuccess: (run) => {
      // Optimistic update with server response, then invalidate to guarantee freshness.
      // The invalidation is the reliable fallback in case the optimistic data is stale
      // (e.g. SQLAlchemy identity-map edge cases in the same session).
      queryClient.setQueryData(queryKeys.divisions.pairing(divisionId, squadId), run);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.divisions.pairing(divisionId, squadId),
      });
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
      invalidatePairingParticipants(queryClient, divisionId, tournamentId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.divisions.stages(divisionId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.readiness.tournament(tournamentId),
      });
    },
  });
}

/** Add a pair manually to a draft run (manual pairing mode). */
export function useCreateManualPair(divisionId: string, runId: string, squadId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberIds: string[]) => pairingApi.createManualPair(runId, memberIds),
    onSuccess: (run) => {
      queryClient.setQueryData(queryKeys.divisions.pairing(divisionId, squadId), run);
      invalidateDivisionPairing(queryClient, divisionId);
    },
  });
}

/** Delete an unlocked pair from a draft run (manual pairing mode). */
export function useDeleteProposedTeam(divisionId: string, squadId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => pairingApi.deleteProposedTeam(teamId),
    onSuccess: (run) => {
      queryClient.setQueryData(queryKeys.divisions.pairing(divisionId, squadId), run);
      invalidateDivisionPairing(queryClient, divisionId);
    },
  });
}

/** Lock all squad draft pairings before draw generation. */
export function usePublishAllSquadPairings(divisionId: string, tournamentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runs: { runId: string; status: string }[]) =>
      pairingApi.publishAllSquadPairings(runs),
    onSuccess: () => {
      invalidatePairingParticipants(queryClient, divisionId, tournamentId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.divisions.stages(divisionId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.readiness.tournament(tournamentId),
      });
    },
  });
}
