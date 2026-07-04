/**
 * Pure dashboard derivations — composes existing API shapes; no business rules duplicated.
 */

import type {
  DivisionReadinessView,
  DivisionResponse,
  MatchView,
  ParticipantResponse,
  ScheduleQueueView,
  StageResponse,
  StandingRowView,
  StandingsView,
  TournamentReadinessView,
  TournamentResponse,
  TournamentStatus,
} from "@tournament/api-client";

import { deriveCapacity } from "@/features/registrations/capacity";
import type { RegistrationResponse } from "@tournament/api-client";

export type DashboardPhase = "before" | "during" | "after";

export type AlertTone = "warning" | "info" | "error";

export interface DashboardAlert {
  id: string;
  tone: AlertTone;
  message: string;
  href?: string;
}

export interface MatchProgress {
  total: number;
  terminal: number;
  pct: number;
}

export interface RegistrationTotals {
  approved: number;
  pending: number;
  waitlisted: number;
  rejected: number;
}

export interface ChampionRow {
  divisionId: string;
  divisionName: string;
  stageId: string;
  participantId: string;
  displayName: string;
}

export interface TournamentStats {
  walkovers: number;
  noShows: number;
  gamesPlayed: number;
}

export interface DashboardStat {
  label: string;
  value: string;
  tone?: "mint" | "candy" | "pink" | "yellow" | "muted";
}

const BEFORE_STATUSES = new Set<TournamentStatus>(["draft", "registration", "seeding"]);

const TERMINAL_MATCH = new Set(["completed", "walkover", "no_show", "cancelled"]);

export function getDashboardPhase(status: TournamentStatus): DashboardPhase {
  if (BEFORE_STATUSES.has(status)) return "before";
  if (status === "live") return "during";
  return "after";
}

export function deriveMatchProgress(matches: MatchView[]): MatchProgress {
  const total = matches.length;
  const terminal = matches.filter((m) => TERMINAL_MATCH.has(m.status)).length;
  const pct = total > 0 ? Math.round((terminal / total) * 100) : 0;
  return { total, terminal, pct };
}

export function deriveRegistrationTotals(
  registrationsByDivision: Map<string, RegistrationResponse[]>,
  participantsByDivision: Map<string, ParticipantResponse[]>,
): RegistrationTotals {
  let approved = 0;
  let pending = 0;
  let waitlisted = 0;
  let rejected = 0;

  for (const [divisionId, registrations] of registrationsByDivision) {
    const participants = participantsByDivision.get(divisionId) ?? [];
    const summary = deriveCapacity(null, registrations, participants);
    approved += summary.approved;
    pending += summary.pending;
    waitlisted += summary.waitlisted;
    rejected += summary.rejected;
  }

  return { approved, pending, waitlisted, rejected };
}

export function deriveDrawProgress(stages: StageResponse[]): { drawn: number; total: number } {
  return {
    drawn: stages.filter((s) => s.drawn).length,
    total: stages.length,
  };
}

export function deriveReadinessSummary(readiness: TournamentReadinessView | undefined) {
  if (!readiness) {
    return { checkedIn: 0, approved: 0, divisionsReady: 0, totalDivisions: 0 };
  }
  const approved = readiness.divisions.reduce((s, d) => s + d.approved, 0);
  const divisionsReady = readiness.divisions.filter(
    (d) => d.readyForDraw || d.readyForStart,
  ).length;
  return {
    checkedIn: readiness.totalCheckedIn,
    approved,
    divisionsReady,
    totalDivisions: readiness.divisions.length,
  };
}

export function deriveTournamentStats(matches: MatchView[]): TournamentStats {
  let walkovers = 0;
  let noShows = 0;
  let gamesPlayed = 0;

  for (const m of matches) {
    if (m.status === "walkover") walkovers += 1;
    if (m.status === "no_show") noShows += 1;
    const games = m.resultPayload?.games;
    if (Array.isArray(games)) gamesPlayed += games.length;
  }

  return { walkovers, noShows, gamesPlayed };
}

export function deriveChampions(
  divisions: DivisionResponse[],
  stagesByDivision: Map<string, StageResponse[]>,
  standingsByStage: Map<string, StandingsView>,
  participantsById: Map<string, ParticipantResponse>,
): ChampionRow[] {
  const champions: ChampionRow[] = [];

  for (const division of divisions) {
    const stages = (stagesByDivision.get(division.id) ?? []).slice().sort((a, b) => b.seq - a.seq);
    const finalStage = stages.find((s) => s.drawn);
    if (!finalStage) continue;

    const standings = standingsByStage.get(finalStage.id);
    const winner = standings?.rows.find((r) => r.rank === 1);
    if (!winner) continue;

    champions.push({
      divisionId: division.id,
      divisionName: division.name,
      stageId: finalStage.id,
      participantId: winner.participantId,
      displayName:
        participantsById.get(winner.participantId)?.displayName ?? winner.participantId.slice(0, 8),
    });
  }

  return champions;
}

export interface DeriveAlertsInput {
  tournament: TournamentResponse;
  readiness?: TournamentReadinessView;
  queue?: ScheduleQueueView;
  matches: MatchView[];
  registrationTotals: RegistrationTotals;
  drawProgress: { drawn: number; total: number };
}

export function deriveAlerts(input: DeriveAlertsInput): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];
  const { tournament, readiness, queue, matches, registrationTotals, drawProgress } = input;
  const phase = getDashboardPhase(tournament.status as TournamentStatus);
  const tournamentBase = `/console/tournaments/${tournament.id}`;

  if (readiness) {
    const squadCount = readiness.squadCount ?? 0;
    const unassigned = readiness.unassignedSquadMembers ?? 0;
    const squadsReady = readiness.squadsReady ?? true;
    if (squadCount > 0 && !squadsReady && unassigned > 0 && phase !== "after") {
      alerts.push({
        id: "unassigned-squads",
        tone: "warning",
        message: `${unassigned} player${unassigned === 1 ? "" : "s"} still need a team assignment`,
        href: `${tournamentBase}/teams`,
      });
    }
    for (const div of readiness.divisions) {
      for (const blocker of div.blockers) {
        alerts.push({
          id: `blocker-${div.divisionId}-${blocker}`,
          tone: "warning",
          message: `${div.divisionName}: ${blocker}`,
          href: `${tournamentBase}/divisions/${div.divisionId}/attendance`,
        });
      }
    }
    if (readiness.totalPending > 0 && phase !== "after") {
      alerts.push({
        id: "pending-checkin",
        tone: "warning",
        message: `${readiness.totalPending} participant${readiness.totalPending === 1 ? "" : "s"} still pending check-in`,
        href: `${tournamentBase}/readiness`,
      });
    }
  }

  if (registrationTotals.pending > 0 && phase === "before") {
    alerts.push({
      id: "pending-registrations",
      tone: "info",
      message: `${registrationTotals.pending} registration${registrationTotals.pending === 1 ? "" : "s"} awaiting review`,
    });
  }

  if (queue) {
    const delayed = queue.courts.filter((c) => c.isDelayed).length;
    if (delayed > 0) {
      alerts.push({
        id: "delayed-courts",
        tone: "error",
        message: `${delayed} court${delayed === 1 ? "" : "s"} running delayed`,
        href: `${tournamentBase}/schedule`,
      });
    }
    if (queue.unscheduled.length > 5 && phase === "during") {
      alerts.push({
        id: "unscheduled-queue",
        tone: "warning",
        message: `${queue.unscheduled.length} matches waiting for a court`,
        href: `${tournamentBase}/schedule`,
      });
    }
  }

  const pendingMatches = matches.filter((m) => m.status === "pending").length;
  if (pendingMatches > 0 && phase === "during") {
    alerts.push({
      id: "pending-bracket",
      tone: "info",
      message: `${pendingMatches} match${pendingMatches === 1 ? "" : "es"} waiting on earlier results`,
      href: `${tournamentBase}/matches`,
    });
  }

  if (
    phase !== "after" &&
    drawProgress.total > 0 &&
    drawProgress.drawn === drawProgress.total &&
    !tournament.drawPublishedAt
  ) {
    alerts.push({
      id: "publish-draw",
      tone: "info",
      message: "All draws complete — consider publishing the draw to the public site",
    });
  }

  if (
    phase === "during" &&
    deriveMatchProgress(matches).pct >= 80 &&
    !tournament.resultsPublishedAt
  ) {
    alerts.push({
      id: "publish-results-soon",
      tone: "info",
      message: "Most matches are done — prepare to publish results when finished",
    });
  }

  return alerts;
}

export function deriveBeforeStats(
  readiness: TournamentReadinessView | undefined,
  registrationTotals: RegistrationTotals,
  drawProgress: { drawn: number; total: number },
): DashboardStat[] {
  const rs = deriveReadinessSummary(readiness);
  return [
    { label: "Approved", value: String(registrationTotals.approved), tone: "candy" },
    { label: "Checked in", value: `${rs.checkedIn}/${rs.approved || "—"}`, tone: "mint" },
    {
      label: "Divisions ready",
      value: `${rs.divisionsReady}/${rs.totalDivisions || "—"}`,
      tone: rs.divisionsReady === rs.totalDivisions && rs.totalDivisions > 0 ? "mint" : "yellow",
    },
    {
      label: "Draws complete",
      value: drawProgress.total > 0 ? `${drawProgress.drawn}/${drawProgress.total}` : "—",
      tone: drawProgress.drawn === drawProgress.total && drawProgress.total > 0 ? "mint" : "muted",
    },
  ];
}

export function deriveDuringStats(
  matches: MatchView[],
  queue: ScheduleQueueView | undefined,
): DashboardStat[] {
  const progress = deriveMatchProgress(matches);
  const liveOnCourts = queue?.courts.filter((c) => c.currentMatch).length ?? 0;
  const delayed = queue?.courts.filter((c) => c.isDelayed).length ?? 0;
  const waiting = queue?.unscheduled.length ?? 0;

  return [
    { label: "Matches done", value: `${progress.pct}%`, tone: "mint" },
    { label: "Live on courts", value: String(liveOnCourts), tone: "pink" },
    { label: "Waiting for court", value: String(waiting), tone: waiting > 0 ? "yellow" : "muted" },
    { label: "Delayed courts", value: String(delayed), tone: delayed > 0 ? "pink" : "muted" },
  ];
}

export function deriveAfterStats(
  matches: MatchView[],
  divisions: DivisionResponse[],
  tournament: TournamentResponse,
): DashboardStat[] {
  const progress = deriveMatchProgress(matches);
  const stats = deriveTournamentStats(matches);
  const divisionsWithDraw = divisions.length;

  return [
    { label: "Matches played", value: `${progress.terminal}/${progress.total}`, tone: "mint" },
    { label: "Divisions", value: String(divisionsWithDraw), tone: "candy" },
    {
      label: "Walkovers / no-shows",
      value: `${stats.walkovers} / ${stats.noShows}`,
      tone: stats.walkovers + stats.noShows > 0 ? "yellow" : "muted",
    },
    {
      label: "Results published",
      value: tournament.resultsPublishedAt ? "Yes" : "No",
      tone: tournament.resultsPublishedAt ? "mint" : "yellow",
    },
  ];
}

export function countUnpairedFromReadiness(divisions: DivisionReadinessView[]): number {
  return divisions.reduce((s, d) => s + d.unpairedEntrants, 0);
}

export function topStandingsRows(
  standings: StandingsView | undefined,
  limit = 5,
): StandingRowView[] {
  if (!standings) return [];
  return standings.rows
    .filter((r) => r.rank != null)
    .slice()
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    .slice(0, limit);
}
