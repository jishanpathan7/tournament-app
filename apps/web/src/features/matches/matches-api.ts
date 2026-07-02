import type {
  ActivityEventView,
  MatchView,
  ParticipantResponse,
  StageResponse,
} from "@tournament/api-client";

import * as registrationsApi from "@/features/registrations/registrations-api";
import * as tournamentsApi from "@/features/tournaments/tournaments-api";
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

/** There's no tournament-wide participants endpoint, so this fans out to every
 * division's participant list (the existing per-division endpoint) and merges them —
 * plain data-fetching orchestration, not a new backend capability. */
export async function listTournamentParticipants(
  tournamentId: string,
): Promise<ParticipantResponse[]> {
  const divisions = await tournamentsApi.listDivisions(tournamentId);
  const lists = await Promise.all(
    divisions.map((division) => registrationsApi.listParticipants(division.id)),
  );
  return lists.flat();
}

/** Same fan-out shape as `listTournamentParticipants`, for the stage filter's labels
 * (format + seq) — there's no tournament-wide stages endpoint either. */
export async function listTournamentStages(tournamentId: string): Promise<StageResponse[]> {
  const divisions = await tournamentsApi.listDivisions(tournamentId);
  const lists = await Promise.all(
    divisions.map((division) => tournamentsApi.listStages(division.id)),
  );
  return lists.flat();
}
