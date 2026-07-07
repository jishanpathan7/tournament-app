import type {
  MatchResultEventView,
  MatchView,
  PublicDivisionView,
  PublicParticipantView,
  PublicStageView,
  PublicTournamentSearchResult,
  PublicTournamentView,
  StandingsView,
} from "@tournament/api-client";

import { env } from "@/lib/env";
import { safeErrorMessage } from "@/lib/safe-error-message";

/**
 * Transport for the public microsite — plain `fetch`, not the console's `api` axios
 * instance. That instance's 401-refresh-retry interceptor assumes an authenticated
 * session and, on failure, dispatches `AUTH_EXPIRED_EVENT` (which redirects to
 * `/login`) — exactly wrong for an anonymous visitor who was never logged in. Every
 * public endpoint is unauthenticated GET, so there's nothing that transport was
 * buying us here. Works identically from a Server Component (SSR, for SEO) and a
 * client component (TanStack Query refetch/realtime-triggered invalidation).
 */

const BASE = `${env.apiUrl}/api/v1/public`;

export class PublicApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "PublicApiError";
    this.status = status;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate: 30 } });
  if (!res.ok) {
    throw new PublicApiError(res.status, safeErrorMessage(res.status));
  }
  return (await res.json()) as T;
}

export function getTournament(slug: string): Promise<PublicTournamentView> {
  return getJson(`/tournaments/${encodeURIComponent(slug)}`);
}

export function listDivisions(slug: string): Promise<PublicDivisionView[]> {
  return getJson(`/tournaments/${encodeURIComponent(slug)}/divisions`);
}

export function listStages(slug: string): Promise<PublicStageView[]> {
  return getJson(`/tournaments/${encodeURIComponent(slug)}/stages`);
}

export function listParticipants(slug: string): Promise<PublicParticipantView[]> {
  return getJson(`/tournaments/${encodeURIComponent(slug)}/participants`);
}

export function getParticipant(
  slug: string,
  participantId: string,
): Promise<PublicParticipantView> {
  return getJson(
    `/tournaments/${encodeURIComponent(slug)}/participants/${encodeURIComponent(participantId)}`,
  );
}

export function listMatches(slug: string): Promise<MatchView[]> {
  return getJson(`/tournaments/${encodeURIComponent(slug)}/matches`);
}

export function getMatch(slug: string, matchId: string): Promise<MatchView> {
  return getJson(`/tournaments/${encodeURIComponent(slug)}/matches/${encodeURIComponent(matchId)}`);
}

export function listMatchEvents(slug: string, matchId: string): Promise<MatchResultEventView[]> {
  return getJson(
    `/tournaments/${encodeURIComponent(slug)}/matches/${encodeURIComponent(matchId)}/events`,
  );
}

export function getStandings(slug: string, stageId: string): Promise<StandingsView> {
  return getJson(
    `/tournaments/${encodeURIComponent(slug)}/stages/${encodeURIComponent(stageId)}/standings`,
  );
}

export function searchTournaments(query: string): Promise<PublicTournamentSearchResult[]> {
  return getJson(`/search?q=${encodeURIComponent(query)}`);
}

export interface PublicCourtMatchView {
  id: string;
  status: string;
  courtId: string | null;
  scheduledAt: string | null;
  sides: { participantId: string; outcome: string | null }[];
}

export interface PublicCourtQueueView {
  court: { id: string; name: string; status: string; venueName: string };
  currentMatch: PublicCourtMatchView | null;
  nextMatch: PublicCourtMatchView | null;
  isDelayed: boolean;
}

export interface PublicScheduleQueueView {
  courts: PublicCourtQueueView[];
  unscheduled: PublicCourtMatchView[];
  pending: PublicCourtMatchView[];
}

export function getCourts(slug: string): Promise<PublicScheduleQueueView> {
  return getJson(`/tournaments/${encodeURIComponent(slug)}/courts`);
}

export interface PlayerStatRow {
  participantId: string;
  displayName: string;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  winRate: number;
  squadName: string | null;
}

export interface PlayerStatsView {
  rows: PlayerStatRow[];
}

export function getPlayerStats(slug: string): Promise<PlayerStatsView> {
  return getJson(`/tournaments/${encodeURIComponent(slug)}/player-stats`);
}

export interface PublicRegistrationSubmitBody {
  name: string;
  email?: string | null;
  skillLevel?: string | null;
  preferredPartnerName?: string | null;
}

export interface PublicRegistrationSubmitted {
  id: string;
  status: string;
  divisionId: string;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new PublicApiError(res.status, safeErrorMessage(res.status));
  }
  return (await res.json()) as T;
}

export function submitRegistration(
  slug: string,
  divisionId: string,
  body: PublicRegistrationSubmitBody,
): Promise<PublicRegistrationSubmitted> {
  return postJson(
    `/tournaments/${encodeURIComponent(slug)}/divisions/${encodeURIComponent(divisionId)}/registrations`,
    {
      name: body.name,
      email: body.email,
      skillLevel: body.skillLevel,
      preferredPartnerName: body.preferredPartnerName,
    },
  );
}
