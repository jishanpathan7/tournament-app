import type { CheckInLinkView, CheckInSessionView } from "@tournament/api-client";
import { api, apiGet } from "@/lib/api";
import { env } from "@/lib/env";
import { safeErrorMessage } from "@/lib/safe-error-message";

export type { CheckInLinkView, CheckInSessionView };

export function getDivisionCheckInLink(divisionId: string): Promise<CheckInLinkView | null> {
  return apiGet<CheckInLinkView | null>(`/divisions/${divisionId}/checkin-link`);
}

export async function createDivisionCheckInLink(
  divisionId: string,
  expiresInHours = 168,
): Promise<CheckInLinkView> {
  const { data } = await api.post<CheckInLinkView>(`/divisions/${divisionId}/checkin-link`, {
    expiresInHours,
  });
  return data;
}

const PUBLIC_BASE = `${env.apiUrl}/api/v1/public/checkin`;

export class CheckInApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "CheckInApiError";
    this.status = status;
  }
}

function tokenQuery(token: string) {
  return `token=${encodeURIComponent(token)}`;
}

export async function getPublicCheckInSession(token: string): Promise<CheckInSessionView> {
  const res = await fetch(`${PUBLIC_BASE}/session?${tokenQuery(token)}`);
  if (!res.ok) {
    throw new CheckInApiError(res.status, safeErrorMessage(res.status));
  }
  return (await res.json()) as CheckInSessionView;
}

export async function confirmPublicCheckIn(token: string, participantId: string): Promise<void> {
  const res = await fetch(`${PUBLIC_BASE}/confirm?${tokenQuery(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ participantId }),
  });
  if (!res.ok) {
    throw new CheckInApiError(res.status, safeErrorMessage(res.status));
  }
}
