import type { TournamentStatus } from "@tournament/api-client";
import {
  LayoutDashboard,
  Radio,
  SlidersHorizontal,
  Trophy,
  UserRound,
  type LucideIcon,
} from "lucide-react";

/** Primary tournament workspace tabs — organizer mental model, not data model. */
export type TournamentNavKey = "overview" | "participants" | "setup" | "live" | "results";

export interface TournamentNavItem {
  key: TournamentNavKey;
  label: string;
  icon: LucideIcon;
  /** Default route when the tab is clicked. */
  hrefSuffix: string;
}

export const TOURNAMENT_NAV: TournamentNavItem[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, hrefSuffix: "" },
  { key: "participants", label: "Participants", icon: UserRound, hrefSuffix: "/players" },
  { key: "setup", label: "Setup", icon: SlidersHorizontal, hrefSuffix: "/teams" },
  { key: "live", label: "Live", icon: Radio, hrefSuffix: "/matches" },
  { key: "results", label: "Results", icon: Trophy, hrefSuffix: "" },
];

const AFTER_STATUSES = new Set<TournamentStatus>(["completed", "archived"]);

function tournamentBase(tournamentId: string) {
  return `/console/tournaments/${tournamentId}`;
}

/** Map any tournament sub-route to one of the five primary tabs. */
export function resolveTournamentNavKey(
  pathname: string,
  tournamentId: string,
  status: TournamentStatus,
): TournamentNavKey {
  const base = tournamentBase(tournamentId);
  const isDashboard =
    pathname === base || pathname === `${base}/` || pathname.startsWith(`${base}#`);

  if (isDashboard) {
    return AFTER_STATUSES.has(status) ? "results" : "overview";
  }

  const rel = pathname.slice(base.length);

  if (
    rel.startsWith("/players") ||
    rel.includes("/registrations") ||
    rel.includes("/attendance") ||
    rel.startsWith("/readiness")
  ) {
    return "participants";
  }

  if (
    rel.startsWith("/teams") ||
    rel.startsWith("/draws") ||
    rel.startsWith("/schedule") ||
    rel.startsWith("/courts") ||
    rel.startsWith("/draft-ceremony") ||
    rel.startsWith("/team-ties") ||
    rel.includes("/pairing") ||
    rel.includes("/import") ||
    rel.includes("/stages/")
  ) {
    return "setup";
  }

  if (rel.startsWith("/matches") || rel.startsWith("/scorekeeper") || rel.startsWith("/live")) {
    return "live";
  }

  return "overview";
}

export function tournamentNavHref(tournamentId: string, item: TournamentNavItem): string {
  const base = tournamentBase(tournamentId);
  if (item.key === "results") return `${base}#results`;
  return `${base}${item.hrefSuffix}`;
}

export function isTournamentNavActive(
  pathname: string,
  tournamentId: string,
  status: TournamentStatus,
  item: TournamentNavItem,
): boolean {
  return resolveTournamentNavKey(pathname, tournamentId, status) === item.key;
}
