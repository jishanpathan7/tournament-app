"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  MatchResultEventView,
  MatchView,
  PublicDivisionView,
  PublicParticipantView,
  PublicStageView,
  PublicTournamentView,
  StandingsView,
} from "@tournament/api-client";

import * as publicApi from "@/features/public/public-api";
import { publicQueryKeys } from "@/features/public/query-keys";

/**
 * Every hook accepts `initialData` — the Server Component page fetches once (for SEO
 * + fast first paint) and passes that payload down as a prop, which seeds the query
 * cache here instead of re-fetching on mount. Realtime events (see
 * `use-public-realtime.ts`) invalidate these same keys, so the client silently takes
 * over from there.
 */

export function usePublicTournament(slug: string, initialData?: PublicTournamentView) {
  return useQuery({
    queryKey: publicQueryKeys.tournament(slug),
    queryFn: () => publicApi.getTournament(slug),
    initialData,
  });
}

export function usePublicDivisions(slug: string, initialData?: PublicDivisionView[]) {
  return useQuery({
    queryKey: publicQueryKeys.divisions(slug),
    queryFn: () => publicApi.listDivisions(slug),
    initialData,
  });
}

export function usePublicPlayerStats(slug: string) {
  return useQuery({
    queryKey: publicQueryKeys.playerStats(slug),
    queryFn: () => publicApi.getPlayerStats(slug),
  });
}

export function usePublicCourts(slug: string) {
  return useQuery({
    queryKey: publicQueryKeys.courts(slug),
    queryFn: () => publicApi.getCourts(slug),
    refetchInterval: 30_000,
  });
}

export function usePublicStages(slug: string, initialData?: PublicStageView[]) {
  return useQuery({
    queryKey: publicQueryKeys.stages(slug),
    queryFn: () => publicApi.listStages(slug),
    initialData,
  });
}

export function usePublicParticipants(slug: string, initialData?: PublicParticipantView[]) {
  return useQuery({
    queryKey: publicQueryKeys.participants(slug),
    queryFn: () => publicApi.listParticipants(slug),
    initialData,
  });
}

export function usePublicParticipant(
  slug: string,
  participantId: string,
  initialData?: PublicParticipantView,
) {
  return useQuery({
    queryKey: publicQueryKeys.participant(slug, participantId),
    queryFn: () => publicApi.getParticipant(slug, participantId),
    initialData,
  });
}

export function usePublicMatches(slug: string, initialData?: MatchView[]) {
  return useQuery({
    queryKey: publicQueryKeys.matches(slug),
    queryFn: () => publicApi.listMatches(slug),
    initialData,
  });
}

export function usePublicMatch(slug: string, matchId: string, initialData?: MatchView) {
  return useQuery({
    queryKey: publicQueryKeys.match(slug, matchId),
    queryFn: () => publicApi.getMatch(slug, matchId),
    initialData,
  });
}

export function usePublicMatchEvents(
  slug: string,
  matchId: string,
  initialData?: MatchResultEventView[],
) {
  return useQuery({
    queryKey: publicQueryKeys.matchEvents(slug, matchId),
    queryFn: () => publicApi.listMatchEvents(slug, matchId),
    initialData,
  });
}

export function usePublicStandings(
  slug: string,
  stageId: string | null,
  initialData?: StandingsView,
) {
  return useQuery({
    queryKey: publicQueryKeys.standings(slug, stageId ?? ""),
    queryFn: () => publicApi.getStandings(slug, stageId!),
    initialData,
    enabled: !!stageId,
  });
}

export function usePublicSearch(query: string) {
  return useQuery({
    queryKey: publicQueryKeys.search(query),
    queryFn: () => publicApi.searchTournaments(query),
    enabled: query.trim().length > 0,
  });
}
