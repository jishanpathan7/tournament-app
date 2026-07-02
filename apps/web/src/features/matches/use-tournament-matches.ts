"use client";

import { useQuery } from "@tanstack/react-query";

import * as matchesApi from "@/features/matches/matches-api";
import { queryKeys } from "@/lib/query-keys";

export function useTournamentMatches(tournamentId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.tournaments.matches(tournamentId),
    queryFn: () => matchesApi.listTournamentMatches(tournamentId),
    enabled: options?.enabled ?? true,
  });
}

export function useTournamentActivity(tournamentId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.tournaments.activity(tournamentId),
    queryFn: () => matchesApi.listTournamentActivity(tournamentId),
    enabled: options?.enabled ?? true,
  });
}

export function useTournamentParticipants(tournamentId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.tournaments.participants(tournamentId),
    queryFn: () => matchesApi.listTournamentParticipants(tournamentId),
    enabled: options?.enabled ?? true,
  });
}

export function useTournamentStages(tournamentId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.tournaments.stages(tournamentId),
    queryFn: () => matchesApi.listTournamentStages(tournamentId),
    enabled: options?.enabled ?? true,
  });
}
