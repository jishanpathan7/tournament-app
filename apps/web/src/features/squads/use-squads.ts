"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  assignSquadMember,
  autoDistributeSquads,
  createSquad,
  deleteSquad,
  getSquads,
  removeSquadMember,
  swapSquadMembers,
  updateSquad,
} from "@/features/squads/squads-api";
import { queryKeys } from "@/lib/query-keys";
import type {
  AutoDistributeRequest,
  CreateSquadRequest,
  SwapMembersRequest,
  TournamentSquadsView,
  UpdateSquadRequest,
} from "@/features/squads/types";

const key = (tournamentId: string) => ["squads", tournamentId] as const;

/**
 * A team's name is stamped onto its players everywhere they appear — the participants
 * list, every match card, the draw, the public microsite. Invalidating only the teams
 * board left all of those showing the old name until something else happened to
 * refetch them, so a rename looked like it had half-applied.
 */
function invalidateTeamNames(qc: ReturnType<typeof useQueryClient>, tournamentId: string) {
  void qc.invalidateQueries({ queryKey: key(tournamentId) });
  void qc.invalidateQueries({ queryKey: queryKeys.tournaments.participants(tournamentId) });
  void qc.invalidateQueries({ queryKey: queryKeys.tournaments.matches(tournamentId) });
  // Division-scoped rosters and pairing runs carry the tag too, and the public
  // microsite reads its own copy — both are keyed by ids we don't have here, so
  // match on the prefix.
  void qc.invalidateQueries({ queryKey: ["divisions"] });
  void qc.invalidateQueries({ queryKey: ["public"] });
}

export function useSquads(tournamentId: string) {
  return useQuery({
    queryKey: key(tournamentId),
    queryFn: () => getSquads(tournamentId),
  });
}

export function useCreateSquad(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSquadRequest) => createSquad(tournamentId, body),
    onSuccess: () => invalidateTeamNames(qc, tournamentId),
  });
}

export function useAutoDistributeSquads(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AutoDistributeRequest) => autoDistributeSquads(tournamentId, body),
    onSuccess: () => invalidateTeamNames(qc, tournamentId),
  });
}

export function useUpdateSquad(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ squadId, ...body }: UpdateSquadRequest & { squadId: string }) =>
      updateSquad(squadId, body),
    onSuccess: () => invalidateTeamNames(qc, tournamentId),
  });
}

export function useAssignSquadMember(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ squadId, registrationId }: { squadId: string; registrationId: string }) =>
      assignSquadMember(squadId, { registrationId }),
    onSuccess: () => invalidateTeamNames(qc, tournamentId),
  });
}

export function useRemoveSquadMember(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ squadId, registrationId }: { squadId: string; registrationId: string }) =>
      removeSquadMember(squadId, registrationId),
    onSuccess: () => invalidateTeamNames(qc, tournamentId),
  });
}

/** Atomic 1-for-1 member trade — seeds the cache with the board the API returns. */
export function useSwapSquadMembers(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SwapMembersRequest) => swapSquadMembers(tournamentId, body),
    onSuccess: (board) => {
      qc.setQueryData(key(tournamentId), board);
      invalidateTeamNames(qc, tournamentId);
    },
  });
}

export function useDeleteSquad(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (squadId: string) => deleteSquad(squadId),
    onMutate: async (squadId) => {
      await qc.cancelQueries({ queryKey: key(tournamentId) });
      const prev = qc.getQueryData<TournamentSquadsView>(key(tournamentId));
      if (prev) {
        const target = prev.squads.find((s) => s.id === squadId);
        const returnedToPool: TournamentSquadsView["unassigned"] = target
          ? target.members.map((m) => ({
              registrationId: m.registrationId,
              displayName: m.displayName,
              skillLevel: m.skillLevel,
              divisionId: m.divisionId,
              divisionName: m.divisionName,
              skillWeight: m.skillWeight,
              status: "approved",
            }))
          : [];
        qc.setQueryData<TournamentSquadsView>(key(tournamentId), {
          ...prev,
          squads: prev.squads.filter((s) => s.id !== squadId),
          unassigned: [...prev.unassigned, ...returnedToPool],
          summary: {
            ...prev.summary,
            squadCount: prev.summary.squadCount - 1,
            assigned: prev.summary.assigned - (target?.memberCount ?? 0),
            unassigned: prev.summary.unassigned + (target?.memberCount ?? 0),
          },
        });
      }
      return { prev };
    },
    onError: (_err, _squadId, ctx) => {
      if (ctx?.prev) qc.setQueryData(key(tournamentId), ctx.prev);
    },
    onSettled: () => invalidateTeamNames(qc, tournamentId),
  });
}
