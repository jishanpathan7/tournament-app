import type {
  CreateDivisionRequest,
  CreateStageRequest,
  CreateTournamentRequest,
  DivisionResponse,
  DrawRequest,
  DrawResponse,
  PublishRequest,
  StageResponse,
  StatusTransitionRequest,
  TournamentResponse,
  UpdateTournamentRequest,
} from "@tournament/api-client";

import { api, apiGet } from "@/lib/api";

/** Typed transport for the tournament domain. Wrapped by `use-tournaments` query/mutation hooks. */

export function listTournaments(): Promise<TournamentResponse[]> {
  return apiGet<TournamentResponse[]>("/tournaments");
}

export function getTournament(id: string): Promise<TournamentResponse> {
  return apiGet<TournamentResponse>(`/tournaments/${id}`);
}

export async function createTournament(body: CreateTournamentRequest): Promise<TournamentResponse> {
  const { data } = await api.post<TournamentResponse>("/tournaments", body);
  return data;
}

export async function updateTournament(
  id: string,
  body: UpdateTournamentRequest,
): Promise<TournamentResponse> {
  const { data } = await api.patch<TournamentResponse>(`/tournaments/${id}`, body);
  return data;
}

export async function transitionStatus(
  id: string,
  body: StatusTransitionRequest,
): Promise<TournamentResponse> {
  const { data } = await api.post<TournamentResponse>(`/tournaments/${id}/status`, body);
  return data;
}

export async function publishTournament(
  id: string,
  body: PublishRequest,
): Promise<TournamentResponse> {
  const { data } = await api.post<TournamentResponse>(`/tournaments/${id}/publish`, body);
  return data;
}

export async function deleteTournament(id: string): Promise<void> {
  await api.delete(`/tournaments/${id}`);
}

export function listDivisions(tournamentId: string): Promise<DivisionResponse[]> {
  return apiGet<DivisionResponse[]>(`/tournaments/${tournamentId}/divisions`);
}

export async function createDivision(
  tournamentId: string,
  body: CreateDivisionRequest,
): Promise<DivisionResponse> {
  const { data } = await api.post<DivisionResponse>(`/tournaments/${tournamentId}/divisions`, body);
  return data;
}

export function listStages(divisionId: string): Promise<StageResponse[]> {
  return apiGet<StageResponse[]>(`/divisions/${divisionId}/stages`);
}

export async function createStage(
  divisionId: string,
  body: CreateStageRequest,
): Promise<StageResponse> {
  const { data } = await api.post<StageResponse>(`/divisions/${divisionId}/stages`, body);
  return data;
}

export async function generateDraw(stageId: string, body: DrawRequest): Promise<DrawResponse> {
  const { data } = await api.post<DrawResponse>(`/stages/${stageId}/draw`, body);
  return data;
}

export async function clearDraw(stageId: string): Promise<void> {
  await api.delete(`/stages/${stageId}/draw`);
}
