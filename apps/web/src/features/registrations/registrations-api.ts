import type {
  ApproveResult,
  ParticipantResponse,
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

export function getTeam(teamId: string): Promise<TeamResponse> {
  return apiGet<TeamResponse>(`/teams/${teamId}`);
}
