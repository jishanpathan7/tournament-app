import type { MatchView, PublicDivisionView, PublicParticipantView } from "@tournament/api-client";
import {
  BarChart3,
  CalendarDays,
  Home,
  LayoutGrid,
  Network,
  Radio,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Pure helpers for the public microsite. Nothing here recomputes competition state —
 * `matchStatusMeta`/`groupMatchesByRound`/`groupMatchesByGroup` are reused as-is from
 * `features/draws/config` (already pure and PII-free); this file only adds
 * public-page-specific formatting and filtering on top of already-fetched data.
 */

export interface PublicTab {
  key:
    | "overview"
    | "participants"
    | "fixtures"
    | "bracket"
    | "standings"
    | "live"
    | "courts"
    | "stats";
  label: string;
  icon: LucideIcon;
}

export const PUBLIC_TABS: PublicTab[] = [
  { key: "overview", label: "Overview", icon: Home },
  { key: "participants", label: "Participants", icon: Users },
  { key: "fixtures", label: "Fixtures", icon: CalendarDays },
  { key: "bracket", label: "Bracket", icon: Network },
  { key: "standings", label: "Standings", icon: BarChart3 },
];

export const LIVE_TAB: PublicTab = { key: "live", label: "Live", icon: Radio };
export const COURTS_TAB: PublicTab = { key: "courts", label: "Courts", icon: LayoutGrid };

export const STATS_TAB: PublicTab = { key: "stats", label: "Stats", icon: BarChart3 };

export function formatDateRange(startsAt: string | null, endsAt: string | null): string | null {
  if (!startsAt && !endsAt) return null;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  const start = startsAt ? new Date(startsAt).toLocaleDateString(undefined, opts) : null;
  const end = endsAt ? new Date(endsAt).toLocaleDateString(undefined, opts) : null;
  if (start && end && start !== end) return `${start} – ${end}`;
  return start ?? end;
}

/** "12 of 32 spots filled" / "12 registered" if the division has no capacity. */
export function divisionCapacityLabel(division: PublicDivisionView): string {
  if (division.capacity == null) {
    return `${division.approvedCount} registered`;
  }
  return `${division.approvedCount} of ${division.capacity} spots filled`;
}

export function isRegistrationOpen(tournamentStatus: string): boolean {
  return tournamentStatus === "registration";
}

// ---- participant name resolution ----

export function participantName(
  id: string | null | undefined,
  participantsById: Map<string, PublicParticipantView>,
): string {
  if (!id) return "TBD";
  return participantsById.get(id)?.displayName ?? "Unknown";
}

// ---- fixtures filtering (search + stage/round) ----

export interface FixtureFilters {
  stageId: string;
  roundId: string;
  search: string;
}

export const ALL = "all";

export const DEFAULT_FIXTURE_FILTERS: FixtureFilters = {
  stageId: ALL,
  roundId: ALL,
  search: "",
};

export function applyFixtureFilters(
  matches: MatchView[],
  filters: FixtureFilters,
  participantsById: Map<string, PublicParticipantView>,
): MatchView[] {
  const search = filters.search.trim().toLowerCase();
  return matches.filter((m) => {
    if (filters.stageId !== ALL && m.stageId !== filters.stageId) return false;
    if (filters.roundId !== ALL && m.roundId !== filters.roundId) return false;
    if (search) {
      const names = m.sides
        .map((s) => participantName(s.participantId, participantsById))
        .join(" ")
        .toLowerCase();
      if (!names.includes(search)) return false;
    }
    return true;
  });
}

/** "Upcoming" / "Completed" buckets for the Fixtures page. "Today" is omitted because
 * match scheduling is not yet implemented — scheduledAt is always null. */
export type FixtureBucket = "upcoming" | "completed";

const TERMINAL_STATUSES = new Set(["completed", "walkover", "no_show", "cancelled"]);

export function fixtureBucket(match: MatchView): FixtureBucket {
  if (TERMINAL_STATUSES.has(match.status)) return "completed";
  return "upcoming";
}

export function groupByBucket(matches: MatchView[]): Record<FixtureBucket, MatchView[]> {
  const buckets: Record<FixtureBucket, MatchView[]> = { upcoming: [], completed: [] };
  for (const m of matches) buckets[fixtureBucket(m)].push(m);
  return buckets;
}

/** Franchise ties with nested legs; standard matches pass through unchanged. */
export interface FixtureRow {
  kind: "standard" | "tie";
  match: MatchView;
  legs?: MatchView[];
}

export function nestFranchiseFixtures(matches: MatchView[]): FixtureRow[] {
  const legsByParent = new Map<string, MatchView[]>();
  const rows: FixtureRow[] = [];

  for (const m of matches) {
    if (m.contestKind === "leg" && m.parentMatchId) {
      const list = legsByParent.get(m.parentMatchId) ?? [];
      list.push(m);
      legsByParent.set(m.parentMatchId, list);
    }
  }

  for (const m of matches) {
    if (m.contestKind === "leg") continue;
    if (m.contestKind === "tie") {
      const legs = (legsByParent.get(m.id) ?? []).sort(
        (a, b) => (a.roundSeq ?? 0) - (b.roundSeq ?? 0),
      );
      rows.push({ kind: "tie", match: m, legs });
    } else {
      rows.push({ kind: "standard", match: m });
    }
  }
  return rows;
}

export function applyFixtureRowFilters(
  rows: FixtureRow[],
  filters: FixtureFilters,
  participantsById: Map<string, PublicParticipantView>,
): FixtureRow[] {
  const search = filters.search.trim().toLowerCase();
  return rows.filter(({ match, legs }) => {
    if (filters.stageId !== ALL && match.stageId !== filters.stageId) return false;
    if (filters.roundId !== ALL && match.roundId !== filters.roundId) return false;
    if (search) {
      const names = [
        ...match.sides.map((s) => participantName(s.participantId, participantsById)),
        ...(legs ?? []).flatMap((leg) =>
          leg.sides.map((s) => participantName(s.participantId, participantsById)),
        ),
      ]
        .join(" ")
        .toLowerCase();
      if (!names.includes(search)) return false;
    }
    return true;
  });
}

export function groupRowsByBucket(rows: FixtureRow[]): Record<FixtureBucket, FixtureRow[]> {
  const buckets: Record<FixtureBucket, FixtureRow[]> = { upcoming: [], completed: [] };
  for (const row of rows) buckets[fixtureBucket(row.match)].push(row);
  return buckets;
}
