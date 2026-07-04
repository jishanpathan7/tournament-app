import { api, apiGet } from "@/lib/api";

export interface ScorekeeperLinkView {
  id: string;
  matchId: string;
  tournamentId: string;
  expiresAt: string | null;
  revoked: boolean;
  url: string | null;
}

export function getMatchScorekeeperLink(matchId: string): Promise<ScorekeeperLinkView | null> {
  return apiGet<ScorekeeperLinkView | null>(`/matches/${matchId}/scorekeeper-link`);
}

export async function createMatchScorekeeperLink(
  matchId: string,
  options: { expiresInHours?: number; recipientEmail?: string; recipientName?: string } = {},
): Promise<ScorekeeperLinkView> {
  const { data } = await api.post<ScorekeeperLinkView>(`/matches/${matchId}/scorekeeper-link`, {
    expiresInHours: options.expiresInHours ?? 336,
    recipientEmail: options.recipientEmail,
    recipientName: options.recipientName,
  });
  return data;
}

export async function revokeMatchScorekeeperLink(matchId: string): Promise<void> {
  await api.delete(`/matches/${matchId}/scorekeeper-link`);
}
