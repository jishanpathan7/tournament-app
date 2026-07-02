"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AssignCourtRequest,
  CreateCourtRequest,
  CreateVenueRequest,
  UpdateCourtRequest,
} from "@tournament/api-client";

import * as courtsApi from "@/features/courts/courts-api";
import { queryKeys } from "@/lib/query-keys";

export function useVenues() {
  return useQuery({ queryKey: queryKeys.courts.venues(), queryFn: courtsApi.listVenues });
}

export function useCourts() {
  return useQuery({ queryKey: queryKeys.courts.list(), queryFn: courtsApi.listCourts });
}

export function useTournamentCourts(tournamentId: string) {
  return useQuery({
    queryKey: queryKeys.courts.tournament(tournamentId),
    queryFn: () => courtsApi.listTournamentCourts(tournamentId),
  });
}

export function useCreateVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateVenueRequest) => courtsApi.createVenue(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.courts.venues() });
    },
  });
}

export function useCreateCourt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCourtRequest) => courtsApi.createCourt(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.courts.list() });
    },
  });
}

export function useUpdateCourt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { courtId: string; body: UpdateCourtRequest }) =>
      courtsApi.updateCourt(vars.courtId, vars.body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.courts.list() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.courts.all });
    },
  });
}

export function useAssignCourt(tournamentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AssignCourtRequest) => courtsApi.assignCourt(tournamentId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.courts.tournament(tournamentId) });
    },
  });
}

export function useUnassignCourt(tournamentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (courtId: string) => courtsApi.unassignCourt(tournamentId, courtId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.courts.tournament(tournamentId) });
    },
  });
}
