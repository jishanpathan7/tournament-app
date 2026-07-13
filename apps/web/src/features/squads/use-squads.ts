"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  assignSquadMember,
  autoDistributeSquads,
  createSquad,
  deleteSquad,
  getSquads,
  removeSquadMember,
  updateSquad,
} from "@/features/squads/squads-api";
import type {
  AutoDistributeRequest,
  CreateSquadRequest,
  TournamentSquadsView,
  UpdateSquadRequest,
} from "@/features/squads/types";

const key = (tournamentId: string) => ["squads", tournamentId] as const;

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
    onSuccess: () => qc.invalidateQueries({ queryKey: key(tournamentId) }),
  });
}

export function useAutoDistributeSquads(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AutoDistributeRequest) => autoDistributeSquads(tournamentId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(tournamentId) }),
  });
}

export function useUpdateSquad(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ squadId, ...body }: UpdateSquadRequest & { squadId: string }) =>
      updateSquad(squadId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(tournamentId) }),
  });
}

export function useAssignSquadMember(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ squadId, registrationId }: { squadId: string; registrationId: string }) =>
      assignSquadMember(squadId, { registrationId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(tournamentId) }),
  });
}

export function useRemoveSquadMember(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ squadId, registrationId }: { squadId: string; registrationId: string }) =>
      removeSquadMember(squadId, registrationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(tournamentId) }),
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
    onSettled: () => qc.invalidateQueries({ queryKey: key(tournamentId) }),
  });
}
