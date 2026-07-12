import {
  LayoutDashboard,
  Radio,
  SlidersHorizontal,
  Trophy,
  Users,
  UserRound,
  type LucideIcon,
} from "lucide-react";

/** Primary tournament workspace tabs — organizer mental model, not data model. */
export type TournamentNavKey = "overview" | "participants" | "setup" | "live" | "results" | "staff";

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
  { key: "setup", label: "Setup", icon: SlidersHorizontal, hrefSuffix: "/setup" },
  { key: "live", label: "Live", icon: Radio, hrefSuffix: "/matches" },
  { key: "results", label: "Results", icon: Trophy, hrefSuffix: "/results" },
  { key: "staff", label: "Staff", icon: Users, hrefSuffix: "/staff" },
];

function tournamentBase(tournamentId: string) {
  return `/console/tournaments/${tournamentId}`;
}

/** Map any tournament sub-route to one of the five primary tabs. */
export function resolveTournamentNavKey(pathname: string, tournamentId: string): TournamentNavKey {
  const base = tournamentBase(tournamentId);
  const isDashboard =
    pathname === base || pathname === `${base}/` || pathname.startsWith(`${base}#`);

  if (isDashboard) {
    return "overview";
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
    rel.startsWith("/setup") ||
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

  if (rel.startsWith("/results")) {
    return "results";
  }

  if (rel.startsWith("/staff")) {
    return "staff";
  }

  return "overview";
}

export function tournamentNavHref(tournamentId: string, item: TournamentNavItem): string {
  return `${tournamentBase(tournamentId)}${item.hrefSuffix}`;
}

export function isTournamentNavActive(
  pathname: string,
  tournamentId: string,
  item: TournamentNavItem,
): boolean {
  return resolveTournamentNavKey(pathname, tournamentId) === item.key;
}
