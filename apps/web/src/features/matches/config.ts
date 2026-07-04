import type { MatchView, ParticipantResponse, StageResponse } from "@tournament/api-client";

import { MATCH_STATUS } from "@/features/draws/config";
import { BADMINTON_DEFAULTS } from "@/features/matches/badminton-scoring";
import { getFormat } from "@/features/tournaments/config";

/**
 * Pure helpers for the Match Center — queue filtering, score-entry payload shaping, and
 * activity-feed labels. No competition logic lives here: score validation, outcomes, and
 * bracket advancement are entirely the backend Sport Profile / AdvancementEngine's job.
 * `buildScorePayload` only reshapes already-entered form values into the JSON contract
 * the backend expects — it never decides who won or whether a score is legal.
 */

// ---- match queue filters ----

export interface MatchQueueFilters {
  stageId: string;
  roundId: string;
  groupId: string;
  courtId: string;
  status: string;
  search: string;
}

export const ALL = "all";

export const DEFAULT_MATCH_QUEUE_FILTERS: MatchQueueFilters = {
  stageId: ALL,
  roundId: ALL,
  groupId: ALL,
  courtId: ALL,
  status: ALL,
  search: "",
};

export function applyMatchQueueFilters(
  matches: MatchView[],
  filters: MatchQueueFilters,
  participantsById: Map<string, ParticipantResponse>,
): MatchView[] {
  const search = filters.search.trim().toLowerCase();
  return matches.filter((m) => {
    if (filters.stageId !== ALL && m.stageId !== filters.stageId) return false;
    if (filters.roundId !== ALL && m.roundId !== filters.roundId) return false;
    if (filters.groupId !== ALL && m.groupId !== filters.groupId) return false;
    if (filters.courtId !== ALL && (m.courtId ?? "unassigned") !== filters.courtId) return false;
    if (filters.status !== ALL && m.status !== filters.status) return false;
    if (search) {
      const names = m.sides
        .map((s) => participantsById.get(s.participantId)?.displayName ?? "")
        .join(" ")
        .toLowerCase();
      if (!names.includes(search)) return false;
    }
    return true;
  });
}

export interface FilterOption {
  value: string;
  label: string;
}

export const STATUS_OPTIONS: FilterOption[] = Object.entries(MATCH_STATUS).map(
  ([value, meta]) => ({ value, label: meta.label }),
);

export function stageOptions(stages: StageResponse[]): FilterOption[] {
  return stages
    .slice()
    .sort((a, b) => a.seq - b.seq)
    .map((s) => ({ value: s.id, label: `${getFormat(s.type)?.label ?? s.type} · Stage ${s.seq + 1}` }));
}

export function roundOptions(matches: MatchView[]): FilterOption[] {
  const seen = new Map<string, { seq: number; label: string }>();
  for (const m of matches) {
    if (m.roundId && !seen.has(m.roundId)) {
      seen.set(m.roundId, { seq: m.roundSeq ?? 0, label: m.roundLabel ?? "Round" });
    }
  }
  return [...seen.entries()]
    .sort((a, b) => a[1].seq - b[1].seq)
    .map(([value, v]) => ({ value, label: v.label }));
}

export function groupOptions(matches: MatchView[]): FilterOption[] {
  const seen = new Map<string, string>();
  for (const m of matches) {
    if (m.groupId && !seen.has(m.groupId)) seen.set(m.groupId, m.groupName ?? "Group");
  }
  return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({
    value,
    label,
  }));
}

export function courtLabel(courtId: string | null): string {
  return courtId ? `Court ${courtId.slice(0, 6)}` : "Unassigned";
}

/** Scoreable = both sides are known. `pending` matches are still waiting on an earlier
 * result (winner_of ref unresolved); `cancelled` matches are dead. Everything else —
 * scheduled, completed, walkover, no_show — can be scored or corrected. */
export function isScoreable(status: string): boolean {
  return status !== "pending" && status !== "cancelled";
}

export function courtOptions(matches: MatchView[]): FilterOption[] {
  const seen = new Set<string>();
  for (const m of matches) if (m.courtId) seen.add(m.courtId);
  return [...seen].sort().map((value) => ({ value, label: courtLabel(value) }));
}

/** Quick-glance counts for the queue header — e.g. "12 scheduled · 3 pending". */
export function countByStatus(matches: MatchView[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const m of matches) counts[m.status] = (counts[m.status] ?? 0) + 1;
  return counts;
}

// ---- keyboard-first queue navigation ----

/** Clamped (non-wrapping) step through an ordered id list — drives arrow-key focus
 * movement in the match queue without the queue needing to know about DOM order. */
export function stepFocusId(
  ids: string[],
  currentId: string | null,
  direction: 1 | -1,
): string | null {
  if (ids.length === 0) return null;
  if (currentId === null) return direction === 1 ? ids[0]! : ids[ids.length - 1]!;
  const idx = ids.indexOf(currentId);
  if (idx === -1) return ids[0]!;
  const next = idx + direction;
  if (next < 0 || next >= ids.length) return ids[idx]!;
  return ids[next]!;
}

// ---- score entry ----

export type ResultType = "normal" | "walkover" | "retirement" | "no_show";

export const RESULT_TYPES: { value: ResultType; label: string; description: string }[] = [
  { value: "normal", label: "Final score", description: "Enter the game-by-game score." },
  { value: "walkover", label: "Walkover", description: "One side never started the match." },
  { value: "retirement", label: "Retirement", description: "One side retired mid-match." },
  {
    value: "no_show",
    label: "No-show",
    description: "Neither side started; one side is credited the win.",
  },
];

export interface GameScore {
  a: number | null;
  b: number | null;
}

export interface ScoreFormValues {
  resultType: ResultType;
  games: GameScore[];
  winnerSide: 0 | 1 | null; // walkover / no_show
  retiredSide: 0 | 1 | null; // retirement
}

export function emptyScoreForm(gameSlots: number = BADMINTON_DEFAULTS.bestOf): ScoreFormValues {
  return {
    resultType: "normal",
    games: Array.from({ length: gameSlots }, () => ({ a: null, b: null })),
    winnerSide: null,
    retiredSide: null,
  };
}

function gamesToPayload(games: GameScore[]): number[][] {
  return games.filter((g) => g.a !== null && g.b !== null).map((g) => [g.a as number, g.b as number]);
}

/** Reshapes score-entry form state into the JSON payload the Sport Profile expects
 * (badminton: `{games, endedBy}` / `{endedBy, walkoverWinner}` / `{endedBy, retiredSide,
 * games}`). Pure serialization — never evaluates whether the result is actually legal. */
export function buildScorePayload(values: ScoreFormValues): Record<string, unknown> {
  switch (values.resultType) {
    case "walkover":
      return { endedBy: "walkover", walkoverWinner: values.winnerSide };
    case "no_show":
      return { endedBy: "no_show", walkoverWinner: values.winnerSide };
    case "retirement":
      return {
        endedBy: "retirement",
        retiredSide: values.retiredSide,
        games: gamesToPayload(values.games),
      };
    case "normal":
    default:
      return { endedBy: "normal", games: gamesToPayload(values.games) };
  }
}

/** Structural checks only (required fields present, non-negative numbers) — sport rules
 * like win-by-2 or point caps are deliberately left to the backend's 422 response. */
export function validateScoreForm(values: ScoreFormValues): string | null {
  if (values.resultType === "walkover" || values.resultType === "no_show") {
    return values.winnerSide === null ? "Choose which side wins." : null;
  }
  if (values.resultType === "retirement" && values.retiredSide === null) {
    return "Choose which side retired.";
  }
  const filled = gamesToPayload(values.games);
  if (filled.length === 0) return "Enter at least one game score.";
  if (filled.some(([a, b]) => (a ?? 0) < 0 || (b ?? 0) < 0)) return "Scores can't be negative.";
  return null;
}

// ---- activity timeline ----

const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  "tournament.created": "Tournament created",
  "tournament.updated": "Tournament updated",
  "tournament.status_changed": "Tournament status changed",
  "tournament.published": "Tournament published",
  "division.created": "Division created",
  "stage.created": "Stage created",
  "stage.generated": "Draw generated",
  "stage.draw_cleared": "Draw cleared",
  "match.completed": "Match completed",
  "match.corrected": "Match corrected",
};

export function activityActionLabel(action: string): string {
  return ACTIVITY_ACTION_LABELS[action] ?? action;
}
