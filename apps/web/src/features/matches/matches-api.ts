import type {
  ActivityEventView,
  MatchView,
  ParticipantResponse,
  StageResponse,
} from "@tournament/api-client";

import { apiGet } from "@/lib/api";

/** Typed transport for the Match Center — a tournament-wide view over matches that
 * already exist behind `features/scoring`/`features/tournaments`. Nothing here computes
 * competition results; it only reads/aggregates what the backend already exposes. */

export function listTournamentMatches(tournamentId: string): Promise<MatchView[]> {
  return apiGet<MatchView[]>(`/tournaments/${tournamentId}/matches`);
}

export function listTournamentActivity(tournamentId: string): Promise<ActivityEventView[]> {
  return apiGet<ActivityEventView[]>(`/tournaments/${tournamentId}/activity`);
}

export function listTournamentParticipants(tournamentId: string): Promise<ParticipantResponse[]> {
  return apiGet<ParticipantResponse[]>(`/tournaments/${tournamentId}/participants`);
}

export function listTournamentStages(tournamentId: string): Promise<StageResponse[]> {
  return apiGet<StageResponse[]>(`/tournaments/${tournamentId}/stages`);
}
