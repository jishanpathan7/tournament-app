import type { MatchView, StandingsView } from "@tournament/api-client";

import { apiGet } from "@/lib/api";

/** Typed transport for matches + standings (organizer draw/bracket views). Mutations
 * (score submission) belong to a future scoring workflow — this feature only reads. */

export function listStageMatches(stageId: string): Promise<MatchView[]> {
  return apiGet<MatchView[]>(`/stages/${stageId}/matches`);
}

export function getMatch(matchId: string): Promise<MatchView> {
  return apiGet<MatchView>(`/matches/${matchId}`);
}

export function getStandings(stageId: string): Promise<StandingsView> {
  return apiGet<StandingsView>(`/stages/${stageId}/standings`);
}
