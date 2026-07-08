import type {
  ActivityEventView,
  CourtView,
  MatchView,
  ParticipantResponse,
  ScheduleQueueView,
  StageResponse,
} from "@tournament/api-client";

import { MATCH_STATUS } from "@/features/draws/config";
import { BADMINTON_DEFAULTS } from "@/features/matches/badminton-scoring";
import { getFormat } from "@/features/tournaments/config";

const TERMINAL_STATUSES = new Set(["completed", "walkover", "no_show"]);
const FINISHED_STATUSES = new Set(["completed", "walkover", "no_show"]);

/**
 * Pure helpers for the Match Center — queue filtering, score-entry payload shaping, and
 * activity-feed labels. No competition logic lives here: score validation, outcomes, and
 * bracket advancement are entirely the backend Sport Profile / AdvancementEngine's job.
 * `buildScorePayload` only reshapes already-entered form values into the JSON contract
 * the backend expects — it never decides who won or whether a score is legal.
 */

// ---- match queue filters ----

export type QuickFilter = "all" | "live" | "waiting" | "delayed" | "completed";

export interface MatchQueueFilters {
  stageId: string;
  roundId: string;
  groupId: string;
  courtId: string;
  status: string;
  search: string;
  quick: QuickFilter;
}

export const ALL = "all";

export const DEFAULT_MATCH_QUEUE_FILTERS: MatchQueueFilters = {
  stageId: ALL,
  roundId: ALL,
  groupId: ALL,
  courtId: ALL,
  status: ALL,
  search: "",
  quick: "all",
};

export const QUICK_FILTER_OPTIONS: { value: QuickFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "waiting", label: "Waiting" },
  { value: "delayed", label: "Delayed" },
  { value: "completed", label: "Completed" },
];

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

export const STATUS_OPTIONS: FilterOption[] = Object.entries(MATCH_STATUS).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

export function stageOptions(stages: StageResponse[]): FilterOption[] {
  return stages
    .slice()
    .sort((a, b) => a.seq - b.seq)
    .map((s) => ({
      value: s.id,
      label: `${getFormat(s.type)?.label ?? s.type} · Stage ${s.seq + 1}`,
    }));
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
  return [...seen.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([value, label]) => ({
      value,
      label,
    }));
}

export function courtLabel(courtId: string | null): string {
  return courtId ? `Court ${courtId.slice(0, 6)}` : "Unassigned";
}

export function courtLabelFromMap(
  courtId: string | null,
  courtsById: Map<string, CourtView>,
): string {
  if (!courtId) return "Unassigned";
  return courtsById.get(courtId)?.name ?? courtLabel(courtId);
}

export function buildCourtsById(courts: CourtView[]): Map<string, CourtView> {
  return new Map(courts.map((c) => [c.id, c]));
}

export function isMatchDelayed(match: MatchView, now = Date.now()): boolean {
  if (match.status !== "scheduled" || !match.scheduledAt) return false;
  return new Date(match.scheduledAt).getTime() < now;
}

export function formatMatchScore(match: MatchView): string | null {
  if (match.status === "walkover" || match.status === "no_show") return "Walkover";
  if (match.status === "live") {
    const games = (match.resultPayload as Record<string, unknown>).games;
    if (Array.isArray(games) && games.length > 0) {
      const last = games[games.length - 1] as number[];
      if (Array.isArray(last) && last.length === 2) return `${last[0]}–${last[1]}`;
    }
    return "In progress";
  }
  if (match.status !== "completed") return null;
  const games = (match.resultPayload as Record<string, unknown>).games;
  if (!Array.isArray(games) || games.length === 0) return null;
  return (games as number[][])
    .filter((g) => Array.isArray(g) && g.length === 2)
    .map(([a, b]) => `${a}–${b}`)
    .join(", ");
}

export function formatScheduledTime(scheduledAt: string | null): string | null {
  if (!scheduledAt) return null;
  return new Date(scheduledAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export interface OpsMatchSections {
  live: MatchView[];
  upNext: MatchView[];
  waiting: MatchView[];
  delayed: MatchView[];
  recentlyFinished: MatchView[];
}

const RECENTLY_FINISHED_LIMIT = 10;

export function groupMatchesByOpsSection(matches: MatchView[], now = Date.now()): OpsMatchSections {
  const live: MatchView[] = [];
  const upNext: MatchView[] = [];
  const waiting: MatchView[] = [];
  const delayed: MatchView[] = [];
  const finished: MatchView[] = [];

  for (const m of matches) {
    if (m.status === "live") {
      live.push(m);
      continue;
    }
    if (FINISHED_STATUSES.has(m.status)) {
      finished.push(m);
      continue;
    }
    if (m.status === "scheduled") {
      if (isMatchDelayed(m, now)) {
        delayed.push(m);
      } else if (!m.courtId) {
        waiting.push(m);
      } else {
        upNext.push(m);
      }
    }
  }

  finished.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return {
    live,
    upNext,
    waiting,
    delayed,
    recentlyFinished: finished.slice(0, RECENTLY_FINISHED_LIMIT),
  };
}

export interface OpsSummary {
  live: number;
  waitingToStart: number;
  completed: number;
  availableCourts: number;
  delayed: number;
  progressPct: number;
  progressCompleted: number;
  progressTotal: number;
}

export function deriveOpsSummary(
  matches: MatchView[],
  queue?: ScheduleQueueView | null,
): OpsSummary {
  const sections = groupMatchesByOpsSection(matches);
  const progressTotal = matches.length;
  const progressCompleted = matches.filter((m) => TERMINAL_STATUSES.has(m.status)).length;
  const progressPct = progressTotal > 0 ? Math.round((progressCompleted / progressTotal) * 100) : 0;

  const availableCourts =
    queue?.courts.filter((c) => !c.currentMatch && c.court.status !== "disabled").length ?? 0;
  const delayedCourts = queue?.courts.filter((c) => c.isDelayed).length ?? 0;

  return {
    live: sections.live.length,
    waitingToStart: sections.waiting.length + sections.upNext.length,
    completed: progressCompleted,
    availableCourts,
    delayed: sections.delayed.length + delayedCourts,
    progressPct,
    progressCompleted,
    progressTotal,
  };
}

export interface StageProgressRow {
  stageId: string;
  label: string;
  completed: number;
  total: number;
  pct: number;
}

export function deriveTournamentProgress(
  matches: MatchView[],
  stages: StageResponse[],
): { completed: number; total: number; pct: number; byStage: StageProgressRow[] } {
  const total = matches.length;
  const completed = matches.filter((m) => TERMINAL_STATUSES.has(m.status)).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const byStage = stages
    .slice()
    .sort((a, b) => a.seq - b.seq)
    .map((stage) => {
      const stageMatches = matches.filter((m) => m.stageId === stage.id);
      const stageTotal = stageMatches.length;
      const stageCompleted = stageMatches.filter((m) => TERMINAL_STATUSES.has(m.status)).length;
      return {
        stageId: stage.id,
        label: `${getFormat(stage.type)?.label ?? stage.type} · Stage ${stage.seq + 1}`,
        completed: stageCompleted,
        total: stageTotal,
        pct: stageTotal > 0 ? Math.round((stageCompleted / stageTotal) * 100) : 0,
      };
    })
    .filter((row) => row.total > 0);

  return { completed, total, pct, byStage };
}

export type MatchPrimaryAction = "start" | "score" | "view" | "correct";

export function matchPrimaryAction(match: MatchView): {
  label: string;
  action: MatchPrimaryAction;
} {
  if (match.status === "live") return { label: "Resume scoring", action: "score" };
  if (match.status === "scheduled") {
    return match.courtId
      ? { label: "Enter result", action: "start" }
      : { label: "View match", action: "view" };
  }
  if (TERMINAL_STATUSES.has(match.status)) {
    return { label: "View result", action: "correct" };
  }
  return { label: "View match", action: "view" };
}

export interface ContextualCta {
  label: string;
  matchId: string;
  defaultTab: "score" | "overview";
}

export function deriveContextualCta(
  matches: MatchView[],
  courtsById: Map<string, CourtView>,
): ContextualCta | null {
  const sections = groupMatchesByOpsSection(matches);
  if (sections.live.length > 0) {
    const m = sections.live[0]!;
    return { label: "Resume live match", matchId: m.id, defaultTab: "score" };
  }
  if (sections.upNext.length > 0) {
    const m = sections.upNext[0]!;
    const court = m.courtId ? courtsById.get(m.courtId)?.name : null;
    return {
      label: court ? `Score next on ${court}` : "Score next match",
      matchId: m.id,
      defaultTab: "score",
    };
  }
  if (sections.delayed.length > 0) {
    const m = sections.delayed[0]!;
    return { label: "Resolve delayed match", matchId: m.id, defaultTab: "overview" };
  }
  const nextScheduled = matches.find((m) => m.status === "scheduled");
  if (nextScheduled) {
    return { label: "Open next match", matchId: nextScheduled.id, defaultTab: "overview" };
  }
  return null;
}

export function applyQuickFilter(
  matches: MatchView[],
  quick: QuickFilter,
  now = Date.now(),
): MatchView[] {
  if (quick === "all") return matches;
  if (quick === "live") return matches.filter((m) => m.status === "live");
  if (quick === "waiting") {
    return matches.filter((m) => m.status === "scheduled" && !m.courtId);
  }
  if (quick === "delayed") return matches.filter((m) => isMatchDelayed(m, now));
  if (quick === "completed") return matches.filter((m) => FINISHED_STATUSES.has(m.status));
  return matches;
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

/** Pre-fill the score form when correcting an existing result. */
export function scoreFormFromResult(
  match: MatchView,
  gameSlots: number = BADMINTON_DEFAULTS.bestOf,
): ScoreFormValues {
  const payload = match.resultPayload as Record<string, unknown>;
  const endedBy = typeof payload.endedBy === "string" ? payload.endedBy : "normal";
  const gamesRaw = Array.isArray(payload.games) ? payload.games : [];
  const games: GameScore[] = gamesRaw.map((g) => {
    if (Array.isArray(g) && g.length >= 2) {
      return { a: Number(g[0]), b: Number(g[1]) };
    }
    return { a: null, b: null };
  });
  while (games.length < gameSlots) games.push({ a: null, b: null });

  if (endedBy === "walkover") {
    return {
      resultType: "walkover",
      games: emptyScoreForm(gameSlots).games,
      winnerSide: (payload.walkoverWinner as 0 | 1 | null) ?? null,
      retiredSide: null,
    };
  }
  if (endedBy === "no_show") {
    return {
      resultType: "no_show",
      games: emptyScoreForm(gameSlots).games,
      winnerSide: (payload.walkoverWinner as 0 | 1 | null) ?? null,
      retiredSide: null,
    };
  }
  if (endedBy === "retirement") {
    return {
      resultType: "retirement",
      games,
      winnerSide: null,
      retiredSide: (payload.retiredSide as 0 | 1 | null) ?? null,
    };
  }
  return {
    resultType: "normal",
    games,
    winnerSide: null,
    retiredSide: null,
  };
}

export function previewWinnerFromGames(
  games: GameScore[],
  sideLabels: [string, string],
): string | null {
  let winsA = 0;
  let winsB = 0;
  for (const g of games) {
    if (g.a === null || g.b === null) continue;
    if (g.a > g.b) winsA += 1;
    else if (g.b > g.a) winsB += 1;
  }
  if (winsA === winsB) return null;
  return winsA > winsB ? sideLabels[0] : sideLabels[1];
}

function gamesToPayload(games: GameScore[]): number[][] {
  return games
    .filter((g) => g.a !== null && g.b !== null)
    .map((g) => [g.a as number, g.b as number]);
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

const MEANINGFUL_ACTIVITY = new Set([
  "match.completed",
  "match.corrected",
  "match.started",
  "schedule.assigned",
  "schedule.updated",
  "stage.generated",
]);

export function filterMeaningfulActivity(events: ActivityEventView[]): ActivityEventView[] {
  return events.filter(
    (e) =>
      MEANINGFUL_ACTIVITY.has(e.action) ||
      e.entity === "match" ||
      e.action.includes("score") ||
      e.action.includes("schedule"),
  );
}

export function matchIdFromActivity(event: ActivityEventView): string | null {
  if (event.entity === "match") return event.entityId;
  const after = event.after as Record<string, unknown> | null;
  const matchId = after?.matchId ?? after?.id;
  return typeof matchId === "string" ? matchId : null;
}
