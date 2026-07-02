import type {
  AssignCourtRequest,
  CourtView,
  CreateCourtRequest,
  CreateVenueRequest,
  TournamentCourtView,
  UpdateCourtRequest,
  VenueView,
} from "@tournament/api-client";

import { api, apiGet } from "@/lib/api";

/** Typed transport for venue/court CRUD and their assignment to a tournament. */

export function listVenues(): Promise<VenueView[]> {
  return apiGet<VenueView[]>("/venues");
}

export async function createVenue(body: CreateVenueRequest): Promise<VenueView> {
  const { data } = await api.post<VenueView>("/venues", body);
  return data;
}

export function listCourts(): Promise<CourtView[]> {
  return apiGet<CourtView[]>("/courts");
}

export async function createCourt(body: CreateCourtRequest): Promise<CourtView> {
  const { data } = await api.post<CourtView>("/courts", body);
  return data;
}

export async function updateCourt(courtId: string, body: UpdateCourtRequest): Promise<CourtView> {
  const { data } = await api.patch<CourtView>(`/courts/${courtId}`, body);
  return data;
}

export function listTournamentCourts(tournamentId: string): Promise<TournamentCourtView[]> {
  return apiGet<TournamentCourtView[]>(`/tournaments/${tournamentId}/courts`);
}

export async function assignCourt(
  tournamentId: string,
  body: AssignCourtRequest,
): Promise<TournamentCourtView> {
  const { data } = await api.post<TournamentCourtView>(`/tournaments/${tournamentId}/courts`, body);
  return data;
}

export async function unassignCourt(tournamentId: string, courtId: string): Promise<void> {
  await api.delete(`/tournaments/${tournamentId}/courts/${courtId}`);
}
