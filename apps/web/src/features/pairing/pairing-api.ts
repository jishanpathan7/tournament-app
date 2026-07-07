import type {
  GeneratePairingRequest,
  PairingRunView,
  ProposedTeamView,
  PublishPairingResponse,
  SwapMembersRequest,
  UpdateProposedTeamRequest,
} from "@tournament/api-client";

import { api, apiGet } from "@/lib/api";

/** Typed transport for the Smart Pairing Engine — generate/read/edit/swap/publish a
 * division's skill-balanced doubles teams. The backend engine owns every rule. */

export function getPairing(divisionId: string, squadId?: string): Promise<PairingRunView | null> {
  const url = squadId
    ? `/divisions/${divisionId}/pairing?squad_id=${squadId}`
    : `/divisions/${divisionId}/pairing`;
  return apiGet<PairingRunView | null>(url);
}

export async function generatePairing(
  divisionId: string,
  body: GeneratePairingRequest,
): Promise<PairingRunView> {
  const { data } = await api.post<PairingRunView>(
    `/divisions/${divisionId}/pairing/generate`,
    body,
  );
  return data;
}

export async function updateProposedTeam(
  teamId: string,
  body: UpdateProposedTeamRequest,
): Promise<ProposedTeamView> {
  const { data } = await api.patch<ProposedTeamView>(`/pairing/teams/${teamId}`, body);
  return data;
}

export async function swapMembers(
  runId: string,
  body: SwapMembersRequest,
): Promise<PairingRunView> {
  const { data } = await api.post<PairingRunView>(`/pairing/runs/${runId}/swap`, body);
  return data;
}

export async function publishPairing(runId: string): Promise<PublishPairingResponse> {
  const { data } = await api.post<PublishPairingResponse>(`/pairing/runs/${runId}/publish`, {});
  return data;
}

/** Resolve an odd-one-out player: choose an existing player to partner them,
 * allowing that player to compete in two pairs. Returns the updated run. */
export async function addDuplicatePair(
  runId: string,
  body: { unpairedId: string; duplicateId: string },
): Promise<PairingRunView> {
  const { data } = await api.post<PairingRunView>(
    `/pairing/runs/${runId}/duplicate-pair`,
    body,
  );
  return data;
}
