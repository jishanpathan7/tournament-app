import type { MatchResultEventView, MatchView, StandingsView } from "@tournament/api-client";

import { api, apiGet } from "@/lib/api";

/** Typed transport for matches + standings + score submission (organizer/scorekeeper
 * views and the Match Center). The sport-specific result payload is opaque here — it's
 * built by the score-entry form and validated entirely by the backend Sport Profile. */

export function listStageMatches(stageId: string): Promise<MatchView[]> {
  return apiGet<MatchView[]>(`/stages/${stageId}/matches`);
}

export function getMatch(matchId: string): Promise<MatchView> {
  return apiGet<MatchView>(`/matches/${matchId}`);
}

export function getStandings(stageId: string): Promise<StandingsView> {
  return apiGet<StandingsView>(`/stages/${stageId}/standings`);
}

export function listMatchEvents(matchId: string): Promise<MatchResultEventView[]> {
  return apiGet<MatchResultEventView[]>(`/matches/${matchId}/events`);
}

/** The ETag is a response *header*, not part of `MatchView` — fetched fresh right before
 * opening the score-entry form so `scoreMatch` can send it as `If-Match`. */
export async function getMatchEtag(matchId: string): Promise<string | null> {
  const response = await api.get<MatchView>(`/matches/${matchId}`);
  return (response.headers.etag as string | undefined) ?? null;
}

export async function scoreMatch(
  matchId: string,
  payload: Record<string, unknown>,
  opts?: { ifMatch?: string | null; idempotencyKey?: string },
): Promise<MatchView> {
  const headers: Record<string, string> = {};
  if (opts?.ifMatch) headers["If-Match"] = opts.ifMatch;
  if (opts?.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
  const { data } = await api.post<MatchView>(`/matches/${matchId}/score`, { payload }, { headers });
  return data;
}
