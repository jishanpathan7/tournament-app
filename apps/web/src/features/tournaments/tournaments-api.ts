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

/** Irreversible. Only works on a tournament that is already deleted, and the name
 * must be echoed back exactly — the backend rejects a mismatch. */
export async function purgeTournament(id: string, confirmName: string): Promise<void> {
  await api.post(`/tournaments/${id}/purge`, { confirmName });
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

export type UpdateDivisionBody = {
  name?: string;
  participantType?: "individual" | "pair" | "team" | "squad";
  capacity?: number;
  clearCapacity?: boolean;
};

export async function updateDivision(
  divisionId: string,
  body: UpdateDivisionBody,
): Promise<DivisionResponse> {
  const { data } = await api.patch<DivisionResponse>(`/divisions/${divisionId}`, body);
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

export async function updateStageConfig(
  divisionId: string,
  stageId: string,
  config: Record<string, unknown>,
): Promise<StageResponse> {
  const { data } = await api.patch<StageResponse>(
    `/divisions/${divisionId}/stages/${stageId}/config`,
    { config },
  );
  return data;
}

export async function generateDraw(stageId: string, body: DrawRequest): Promise<DrawResponse> {
  const { data } = await api.post<DrawResponse>(`/stages/${stageId}/draw`, body);
  return data;
}

export async function clearDraw(stageId: string): Promise<void> {
  await api.delete(`/stages/${stageId}/draw`);
}

export interface AdvanceToKnockoutBody {
  take: number;
  rng_seed?: number | null;
}

export interface AdvanceToKnockoutResult {
  stage_id: string;
  format: string;
  matches: number;
  scheduled: number;
  pending: number;
}

export async function advanceToKnockout(
  stageId: string,
  body: AdvanceToKnockoutBody,
): Promise<AdvanceToKnockoutResult> {
  const { data } = await api.post<AdvanceToKnockoutResult>(`/stages/${stageId}/advance`, body);
  return data;
}
