import { env } from "@/lib/env";
import { safeErrorMessage } from "@/lib/safe-error-message";

const BASE = `${env.apiUrl}/api/v1/public/scorekeeper`;

export class ScorekeeperApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ScorekeeperApiError";
    this.status = status;
  }
}

export interface ScorekeeperMatchCard {
  matchId: string;
  sideLabels: string[];
  sideTeamNames: (string | null)[];
  matchStatus: string;
  roundLabel: string | null;
  courtId: string | null;
  courtName: string | null;
  scheduledAt: string | null;
  groupName: string | null;
}

export interface SportMatchConfig {
  bestOf: number;
  pointsPerSet: number;
  winBy: number;
  maxPoints: number;
}

export interface ScorekeeperSession {
  tournamentId: string;
  tournamentName: string;
  match: ScorekeeperMatchCard;
  sportConfig: SportMatchConfig;
}

function tokenQuery(token: string) {
  return `token=${encodeURIComponent(token)}`;
}

export async function getSession(
  token: string,
): Promise<{ session: ScorekeeperSession; etag: string | null }> {
  const res = await fetch(`${BASE}/session?${tokenQuery(token)}`);
  if (!res.ok) {
    throw new ScorekeeperApiError(res.status, safeErrorMessage(res.status));
  }
  const session = (await res.json()) as ScorekeeperSession;
  return { session, etag: res.headers.get("etag") };
}

export async function submitScore(
  token: string,
  payload: Record<string, unknown>,
  ifMatch?: string | null,
): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ifMatch) headers["If-Match"] = ifMatch;
  headers["Idempotency-Key"] = crypto.randomUUID();
  const res = await fetch(`${BASE}/score?${tokenQuery(token)}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ payload }),
  });
  if (!res.ok) {
    throw new ScorekeeperApiError(res.status, safeErrorMessage(res.status));
  }
}

export async function startMatch(token: string, ifMatch?: string | null): Promise<void> {
  const headers: Record<string, string> = {};
  if (ifMatch) headers["If-Match"] = ifMatch;
  const res = await fetch(`${BASE}/start?${tokenQuery(token)}`, { method: "POST", headers });
  if (!res.ok) {
    throw new ScorekeeperApiError(res.status, safeErrorMessage(res.status));
  }
}
