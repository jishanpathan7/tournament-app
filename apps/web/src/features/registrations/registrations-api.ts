import type {
  ApproveResult,
  BulkApproveResult,
  ParticipantResponse,
  ParticipantUpdate,
  RegistrationResponse,
  SubmitRegistrationRequest,
  TeamResponse,
} from "@tournament/api-client";

import { api, apiGet } from "@/lib/api";

/** Typed transport for registrations + participants + teams (organizer + submitter views). */

export function listRegistrations(divisionId: string): Promise<RegistrationResponse[]> {
  return apiGet<RegistrationResponse[]>(`/divisions/${divisionId}/registrations`);
}

export function listParticipants(divisionId: string): Promise<ParticipantResponse[]> {
  return apiGet<ParticipantResponse[]>(`/divisions/${divisionId}/participants`);
}

export async function submitRegistration(
  divisionId: string,
  body: SubmitRegistrationRequest,
): Promise<RegistrationResponse> {
  const { data } = await api.post<RegistrationResponse>(
    `/divisions/${divisionId}/registrations`,
    body,
  );
  return data;
}

export async function approveRegistration(registrationId: string): Promise<ApproveResult> {
  const { data } = await api.post<ApproveResult>(`/registrations/${registrationId}/approve`);
  return data;
}

export async function rejectRegistration(registrationId: string): Promise<RegistrationResponse> {
  const { data } = await api.post<RegistrationResponse>(`/registrations/${registrationId}/reject`);
  return data;
}

export async function waitlistRegistration(registrationId: string): Promise<RegistrationResponse> {
  const { data } = await api.post<RegistrationResponse>(
    `/registrations/${registrationId}/waitlist`,
  );
  return data;
}

export async function withdrawRegistration(registrationId: string): Promise<RegistrationResponse> {
  const { data } = await api.post<RegistrationResponse>(
    `/registrations/${registrationId}/withdraw`,
  );
  return data;
}

export async function bulkApproveRegistrations(divisionId: string): Promise<BulkApproveResult> {
  const { data } = await api.post<BulkApproveResult>(
    `/divisions/${divisionId}/registrations/approve-all`,
  );
  return data;
}

export function getTeam(teamId: string): Promise<TeamResponse> {
  return apiGet<TeamResponse>(`/teams/${teamId}`);
}

export async function updateParticipant(
  participantId: string,
  data: ParticipantUpdate,
): Promise<ParticipantResponse> {
  const { data: res } = await api.patch<ParticipantResponse>(
    `/participants/${participantId}`,
    data,
  );
  return res;
}

export async function removeParticipant(
  participantId: string,
): Promise<{ hadTeam: boolean; hadMatches: boolean }> {
  const { data } = await api.delete<{ had_team: boolean; had_matches: boolean }>(
    `/participants/${participantId}`,
  );
  return { hadTeam: data.had_team, hadMatches: data.had_matches };
}
