"use client";

import type { TournamentResponse } from "@tournament/api-client";
import {
  ArrowLeft,
  CalendarClock,
  LayoutGrid,
  LayoutDashboard,
  Pencil,
  Radio,
  Shuffle,
  Smartphone,
  Swords,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { ErrorState } from "@/components/common/error-state";
import { LoadingPanel } from "@/components/common/loading";
import { Button } from "@/components/ui/button";
import { EditTournamentDialog } from "@/features/tournaments/components/detail/edit-tournament-dialog";
import { TournamentActions } from "@/features/tournaments/components/detail/tournament-actions";
import { TournamentStatusBadge } from "@/features/tournaments/components/tournament-status-badge";
import { getSport } from "@/features/tournaments/config";
import { useTournament } from "@/features/tournaments/use-tournaments";
import { useTournamentReadiness } from "@/features/registration-ops/use-registration-ops";
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";
import { ApiError } from "@/lib/problem";
import { cn } from "@/lib/utils";

type TournamentNavStatus = "draft" | "registration" | "seeding" | "live" | "completed" | "archived";

const PREP: TournamentNavStatus[] = ["registration", "seeding"];
const AFTER: TournamentNavStatus[] = ["completed", "archived"];
const ALL: TournamentNavStatus[] = ["draft", ...PREP, "live", ...AFTER];

const NAV = [
  { key: "dashboard",   label: "Dashboard",   icon: LayoutDashboard, suffix: "",             showIn: ALL },
  { key: "players",     label: "Players",      icon: UserRound,       suffix: "/players",     showIn: ["draft", ...PREP] as TournamentNavStatus[] },
  { key: "teams",       label: "Teams",        icon: Users,           suffix: "/teams",        showIn: PREP },
  { key: "draws",       label: "Draws",        icon: Shuffle,         suffix: "/draws",        showIn: PREP },
  { key: "courts",      label: "Courts",       icon: LayoutGrid,      suffix: "/courts",       showIn: [...PREP, "live"] as TournamentNavStatus[] },
  { key: "schedule",    label: "Schedule",     icon: CalendarClock,   suffix: "/schedule",     showIn: PREP },
  { key: "matches",     label: "Match Center", icon: Swords,          suffix: "/matches",      showIn: ["live", ...AFTER] as TournamentNavStatus[] },
  { key: "scorekeeper", label: "Scorekeeper",  icon: Smartphone,      suffix: "/scorekeeper",  showIn: ["live"] as TournamentNavStatus[] },
  { key: "live",        label: "Live",         icon: Radio,           suffix: "/live",         showIn: ["live"] as TournamentNavStatus[] },
] as const;

function navHref(tournamentId: string, suffix: string) {
  return `/console/tournaments/${tournamentId}${suffix}`;
}

function isActive(pathname: string, tournamentId: string, suffix: string) {
  const base = `/console/tournaments/${tournamentId}`;
  if (suffix === "") return pathname === base || pathname === `${base}/`;
  return pathname.startsWith(`${base}${suffix}`);
}

export function TournamentWorkspaceShell({
  tournamentId,
  children,
}: {
  tournamentId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: tournament, isLoading, isError, error, refetch } = useTournament(tournamentId);
  const can = useCan();
  const canManage = can(ACTIONS.TOURNAMENT_UPDATE);
  const [editOpen, setEditOpen] = useState(false);

  const showPending = tournament?.status === "registration" || tournament?.status === "seeding";
  const readiness = useTournamentReadiness(tournamentId, { enabled: showPending && canManage });
  const pendingCount = showPending && canManage ? (readiness.data?.totalPending ?? 0) : 0;

  if (isLoading) return <LoadingPanel label="Loading tournament" />;
  if (isError || !tournament) {
    const notFound = error instanceof ApiError && error.isNotFound;
    return (
      <ErrorState
        error={error}
        onRetry={notFound ? undefined : () => refetch()}
        title={notFound ? "Tournament not found" : "Couldn't load tournament"}
      />
    );
  }

  return (
    <WorkspaceChrome
      tournament={tournament}
      pathname={pathname}
      canManage={canManage}
      pendingCount={pendingCount}
      editOpen={editOpen}
      onEditOpen={setEditOpen}
    >
      {children}
    </WorkspaceChrome>
  );
}

function WorkspaceChrome({
  tournament,
  pathname,
  canManage,
  pendingCount,
  editOpen,
  onEditOpen,
  children,
}: {
  tournament: TournamentResponse;
  pathname: string;
  canManage: boolean;
  pendingCount: number;
  editOpen: boolean;
  onEditOpen: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const sport = getSport(tournament.sportKey);
  const base = `/console/tournaments/${tournament.id}`;

  return (
    <div className="flex flex-col gap-5">
      <Button asChild tone="ghost" size="sm" className="text-muted-foreground -ml-2 self-start">
        <Link href="/console/tournaments">
          <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
          All tournaments
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.28em]">
            {sport?.label ?? tournament.sportKey}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-3xl font-semibold tracking-tight">{tournament.name}</h1>
            <TournamentStatusBadge status={tournament.status} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage ? (
            <Button tone="paper" size="sm" onClick={() => onEditOpen(true)}>
              <Pencil className="h-4 w-4" strokeWidth={2.25} />
              Edit
            </Button>
          ) : null}
          <TournamentActions tournament={tournament} />
        </div>
      </div>

      <nav
        className="border-ink flex flex-wrap gap-1 border-b-2 pb-0"
        aria-label="Tournament workspace"
      >
        {NAV.map(({ key, label, icon: Icon, suffix, showIn }) => {
          if (!showIn.includes(tournament.status as TournamentNavStatus)) return null;
          const active = isActive(pathname, tournament.id, suffix);
          return (
            <Link
              key={key}
              href={navHref(tournament.id, suffix)}
              className={cn(
                "flex items-center gap-1.5 rounded-t-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "border-ink bg-card relative -mb-[2px] border-2 border-b-0"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2.25} />
              {label}
              {key === "players" && pendingCount > 0 ? (
                <span className="bg-candy text-white ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[10px] font-bold leading-none">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              ) : null}
            </Link>
          );
        })}
        <Link
          href={`${base}#divisions`}
          className={cn(
            "text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-t-xl px-3 py-2.5 text-sm font-semibold",
          )}
        >
          <LayoutGrid className="h-4 w-4" strokeWidth={2.25} />
          Divisions
        </Link>
      </nav>

      <div>{children}</div>

      {canManage ? (
        <EditTournamentDialog tournament={tournament} open={editOpen} onOpenChange={onEditOpen} />
      ) : null}
    </div>
  );
}
