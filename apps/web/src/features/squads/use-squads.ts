"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  assignSquadMember,
  autoDistributeSquads,
  createSquad,
  getSquads,
  removeSquadMember,
  updateSquad,
} from "@/features/squads/squads-api";
import type {
  AutoDistributeRequest,
  CreateSquadRequest,
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
    mutationFn: ({
      squadId,
      registrationId,
    }: {
      squadId: string;
      registrationId: string;
    }) => assignSquadMember(squadId, { registrationId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(tournamentId) }),
  });
}

export function useRemoveSquadMember(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      squadId,
      registrationId,
    }: {
      squadId: string;
      registrationId: string;
    }) => removeSquadMember(squadId, registrationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(tournamentId) }),
  });
}
