import type { CourtQueueView, MatchView, ParticipantResponse } from "@tournament/api-client";

import { isTerminal, matchParticipantLabel } from "@/features/scheduling/config";

export type CourtOpsState = "active" | "turnover" | "open" | "disabled";

export function deriveCourtOpsState(entry: CourtQueueView): CourtOpsState {
  if (entry.court.status !== "active") return "disabled";
  if (entry.isDelayed) return "turnover";
  if (entry.currentMatch) return "active";
  if (entry.nextMatch) return "turnover";
  return "open";
}

export function formatMatchSides(
  match: MatchView,
  participantsById: Map<string, ParticipantResponse>,
): { home: string; away: string } {
  const label = matchParticipantLabel(match, participantsById);
  const parts = label.split(" vs ");
  if (parts.length === 2) return { home: parts[0]!, away: parts[1]! };
  return { home: label, away: "" };
}

export function elapsedMinutes(scheduledAt: string | null, now = Date.now()): number | null {
  if (!scheduledAt) return null;
  return Math.max(0, Math.floor((now - new Date(scheduledAt).getTime()) / 60_000));
}

export function liveScoreDisplay(match: MatchView): string | null {
  const a = match.sides[0]?.scoreFor;
  const b = match.sides[1]?.scoreFor;
  if (a != null && b != null && (a > 0 || b > 0)) return `${Math.round(a)} • ${Math.round(b)}`;

  const payload = match.resultPayload as { games?: number[][] } | undefined;
  const games = payload?.games;
  if (games?.length) {
    const last = games[games.length - 1];
    if (last?.length === 2) return `${last[0]} • ${last[1]}`;
  }
  return null;
}

export function setLabel(match: MatchView): string {
  const payload = match.resultPayload as { games?: number[][] } | undefined;
  const gameCount = payload?.games?.length ?? 0;
  if (gameCount > 0) return `SET ${gameCount}`;
  if (match.status === "live") return "LIVE";
  return "IN PLAY";
}

export function estimatedWaitMinutes(index: number, courtsActive: number): number {
  if (courtsActive <= 0) return (index + 1) * 15;
  return Math.max(5, Math.round(((index + 1) * 30) / courtsActive));
}

export function courtUtilization(courts: CourtQueueView[]): {
  pct: number;
  active: number;
  total: number;
} {
  const total = courts.filter((c) => c.court.status === "active").length;
  if (total === 0) return { pct: 0, active: 0, total: 0 };
  const active = courts.filter(
    (c) => c.court.status === "active" && deriveCourtOpsState(c) === "active",
  ).length;
  return { pct: Math.round((active / total) * 100), active, total };
}

export function pickCallTarget(courts: CourtQueueView[]): CourtQueueView | null {
  const open = courts.find(
    (c) => c.court.status === "active" && deriveCourtOpsState(c) === "open",
  );
  if (open) return open;
  return (
    courts.find(
      (c) => c.court.status === "active" && deriveCourtOpsState(c) === "turnover",
    ) ?? null
  );
}

export function countLiveCourts(courts: CourtQueueView[]): number {
  return courts.filter((c) => deriveCourtOpsState(c) === "active").length;
}

export function isScorableWaiting(match: MatchView): boolean {
  return !isTerminal(match.status) && match.status !== "pending";
}
