import type {
  GenerateInviteLinkRequest,
  InviteLinkResponse,
  InviteTournamentMemberRequest,
  TournamentInviteResponse,
  TournamentMemberResponse,
  TournamentMembersListResponse,
  UpdateTournamentMemberRoleRequest,
} from "@tournament/api-client";

import { api, apiGet } from "@/lib/api";

const base = (tournamentId: string) => `/tournaments/${tournamentId}/members`;

export function listMembers(tournamentId: string): Promise<TournamentMembersListResponse> {
  return apiGet<TournamentMembersListResponse>(base(tournamentId));
}

export async function inviteMember(
  tournamentId: string,
  body: InviteTournamentMemberRequest,
): Promise<TournamentInviteResponse> {
  const { data } = await api.post<TournamentInviteResponse>(`${base(tournamentId)}/invite`, body);
  return data;
}

export async function updateMemberRole(
  tournamentId: string,
  userId: string,
  body: UpdateTournamentMemberRoleRequest,
): Promise<TournamentMemberResponse> {
  const { data } = await api.patch<TournamentMemberResponse>(
    `${base(tournamentId)}/${userId}/role`,
    body,
  );
  return data;
}

export async function removeMember(tournamentId: string, userId: string): Promise<void> {
  await api.delete(`${base(tournamentId)}/${userId}`);
}

export async function revokeInvite(tournamentId: string, inviteId: string): Promise<void> {
  await api.post(`${base(tournamentId)}/invites/${inviteId}/revoke`);
}

export async function generateInviteLink(
  tournamentId: string,
  body: GenerateInviteLinkRequest,
): Promise<InviteLinkResponse> {
  const { data } = await api.post<InviteLinkResponse>(`${base(tournamentId)}/invite-link`, body);
  return data;
}

export async function acceptTournamentInvite(token: string): Promise<void> {
  await api.post("/tournament-invites/accept", { token });
}

export async function resendInvite(
  tournamentId: string,
  inviteId: string,
): Promise<TournamentInviteResponse> {
  const { data } = await api.post<TournamentInviteResponse>(
    `${base(tournamentId)}/invites/${inviteId}/resend`,
  );
  return data;
}
