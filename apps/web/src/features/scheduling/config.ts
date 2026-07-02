import type { ConflictView, MatchView, ParticipantResponse } from "@tournament/api-client";

/**
 * Pure helpers for the schedule timeline/queue/dashboard — bucketing matches by court,
 * suggesting a default time slot, and labeling conflicts. No scheduling *decisions* are
 * made here beyond a plain default-slot suggestion for the drop UX; the backend is the
 * single source of truth for conflicts and validity (see `app.modules.scheduling`).
 */

export const DEFAULT_DURATION_MINUTES = 30;

const TERMINAL_STATUSES = new Set(["completed", "walkover", "no_show", "cancelled"]);

export interface ScheduleBuckets {
  /** courtId -> matches on that court, sorted by `scheduledAt`. */
  byCourt: Map<string, MatchView[]>;
  /** Ready to play (bracket resolved) but no court/time yet. */
  unscheduled: MatchView[];
  /** Bracket sides not resolved yet — not schedulable. */
  pending: MatchView[];
}

export function bucketMatches(matches: MatchView[]): ScheduleBuckets {
  const byCourt = new Map<string, MatchView[]>();
  const unscheduled: MatchView[] = [];
  const pending: MatchView[] = [];

  for (const match of matches) {
    if (match.status === "pending") {
      pending.push(match);
    } else if (!match.courtId || !match.scheduledAt) {
      unscheduled.push(match);
    } else {
      const list = byCourt.get(match.courtId) ?? [];
      list.push(match);
      byCourt.set(match.courtId, list);
    }
  }
  for (const list of byCourt.values()) {
    list.sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
  }
  unscheduled.sort((a, b) => (a.roundSeq ?? 0) - (b.roundSeq ?? 0));
  return { byCourt, unscheduled, pending };
}

export function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

/** Default start time for a match dropped onto `courtMatches` — right after the last
 * (non-cancelled) match already on that court, or the tournament start, or now. */
export function suggestNextSlot(
  courtMatches: MatchView[],
  durationMinutes: number,
  tournamentStartsAt: string | null,
): Date {
  const last = courtMatches[courtMatches.length - 1];
  if (last?.scheduledAt) {
    const lastStart = new Date(last.scheduledAt);
    const lastDuration = durationMinutes;
    return new Date(lastStart.getTime() + lastDuration * 60_000);
  }
  if (tournamentStartsAt) return new Date(tournamentStartsAt);
  return new Date();
}

export function matchParticipantLabel(
  match: MatchView,
  participantsById: Map<string, ParticipantResponse>,
): string {
  const names = match.sides.map((s) => participantsById.get(s.participantId)?.displayName ?? "TBD");
  return names.length === 2 ? `${names[0]} vs ${names[1]}` : names.join(", ");
}

export const CONFLICT_LABELS: Record<string, string> = {
  court_unassigned: "Court not assigned to this tournament",
  court_unavailable: "Court unavailable",
  unresolved_match: "Bracket not resolved yet",
  outside_tournament_window: "Outside tournament dates",
  court_overlap: "Court double-booked",
  participant_overlap: "Participant double-booked",
  team_overlap: "Team double-booked",
};

export function conflictLabel(kind: string): string {
  return CONFLICT_LABELS[kind] ?? kind;
}

const HARD_CONFLICT_KINDS = new Set([
  "court_unassigned",
  "court_unavailable",
  "unresolved_match",
  "outside_tournament_window",
]);

export function isHardConflict(kind: string): boolean {
  return HARD_CONFLICT_KINDS.has(kind);
}

export function conflictsForMatch(conflicts: ConflictView[], matchId: string): ConflictView[] {
  return conflicts.filter((c) => c.matchId === matchId);
}

/** `datetime-local` input value (local time, no timezone suffix) for a Date. */
export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
