import type {
  ApproveResult,
  ParticipantResponse,
  RegistrationResponse,
} from "@tournament/api-client";

import { api, apiGet } from "@/lib/api";

/** Typed transport for registrations + participants (organizer views). */

export function listRegistrations(divisionId: string): Promise<RegistrationResponse[]> {
  return apiGet<RegistrationResponse[]>(`/divisions/${divisionId}/registrations`);
}

export function listParticipants(divisionId: string): Promise<ParticipantResponse[]> {
  return apiGet<ParticipantResponse[]>(`/divisions/${divisionId}/participants`);
}

export async function approveRegistration(registrationId: string): Promise<ApproveResult> {
  const { data } = await api.post<ApproveResult>(`/registrations/${registrationId}/approve`);
  return data;
}

export async function rejectRegistration(registrationId: string): Promise<RegistrationResponse> {
  const { data } = await api.post<RegistrationResponse>(`/registrations/${registrationId}/reject`);
  return data;
}
