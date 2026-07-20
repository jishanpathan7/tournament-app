import type {
  AssignMemberRequest,
  AutoDistributeRequest,
  AutoDistributeResponse,
  CreateSquadRequest,
  SwapMembersRequest,
  TournamentSquadsView,
  UpdateSquadRequest,
} from "@/features/squads/types";

import { api, apiGet } from "@/lib/api";

export function getSquads(tournamentId: string): Promise<TournamentSquadsView> {
  return apiGet<TournamentSquadsView>(`/tournaments/${tournamentId}/squads`);
}

export async function createSquad(tournamentId: string, body: CreateSquadRequest): Promise<void> {
  await api.post(`/tournaments/${tournamentId}/squads`, body);
}

export async function autoDistributeSquads(
  tournamentId: string,
  body: AutoDistributeRequest,
): Promise<AutoDistributeResponse> {
  const { data } = await api.post<AutoDistributeResponse>(
    `/tournaments/${tournamentId}/squads/auto-distribute`,
    body,
  );
  return data;
}

/** Atomic 1-for-1 member trade between two squads. Returns the refreshed board. */
export async function swapSquadMembers(
  tournamentId: string,
  body: SwapMembersRequest,
): Promise<TournamentSquadsView> {
  const { data } = await api.post<TournamentSquadsView>(
    `/tournaments/${tournamentId}/squads/swap-members`,
    body,
  );
  return data;
}

export async function updateSquad(squadId: string, body: UpdateSquadRequest): Promise<void> {
  await api.patch(`/squads/${squadId}`, body);
}

export async function assignSquadMember(squadId: string, body: AssignMemberRequest): Promise<void> {
  await api.post(`/squads/${squadId}/members`, body);
}

export async function removeSquadMember(squadId: string, registrationId: string): Promise<void> {
  await api.delete(`/squads/${squadId}/members/${registrationId}`);
}

export async function deleteSquad(squadId: string): Promise<void> {
  await api.delete(`/squads/${squadId}`);
}
