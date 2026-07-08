"use client";

import type { TournamentResponse, TournamentStatus } from "@tournament/api-client";
import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { ErrorState } from "@/components/common/error-state";
import { LoadingPanel } from "@/components/common/loading";
import { Button } from "@/components/ui/button";
import { EditTournamentDialog } from "@/features/tournaments/components/detail/edit-tournament-dialog";
import { TournamentActions } from "@/features/tournaments/components/detail/tournament-actions";
import { MobileTournamentNav } from "@/features/tournaments/components/mobile-tournament-nav";
import {
  TOURNAMENT_NAV,
  isTournamentNavActive,
  tournamentNavHref,
} from "@/features/tournaments/components/tournament-nav-config";
import { TournamentStatusBadge } from "@/features/tournaments/components/tournament-status-badge";
import { getSport } from "@/features/tournaments/config";
import { useTournament } from "@/features/tournaments/use-tournaments";
import { useTournamentReadiness } from "@/features/registration-ops/use-registration-ops";
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";
import { ApiError } from "@/lib/problem";
import { cn } from "@/lib/utils";

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
  const status = tournament.status as TournamentStatus;

  return (
    <div className="flex flex-col gap-5 pb-20 md:pb-0">
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
            <TournamentStatusBadge status={status} />
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
        className="border-ink hidden gap-1 border-b-2 pb-0 md:flex"
        aria-label="Tournament workspace"
      >
        {TOURNAMENT_NAV.map((item) => {
          const active = isTournamentNavActive(pathname, tournament.id, status, item);
          const Icon = item.icon;
          const showBadge = item.key === "participants" && pendingCount > 0;

          return (
            <Link
              key={item.key}
              href={tournamentNavHref(tournament.id, item)}
              className={cn(
                "flex items-center gap-1.5 rounded-t-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "border-ink bg-card relative -mb-[2px] border-2 border-b-0"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2.25} />
              {item.label}
              {showBadge ? (
                <span className="bg-candy ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[10px] font-bold leading-none text-white">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div>{children}</div>

      <MobileTournamentNav
        tournamentId={tournament.id}
        status={status}
        pendingCount={pendingCount}
      />

      {canManage ? (
        <EditTournamentDialog tournament={tournament} open={editOpen} onOpenChange={onEditOpen} />
      ) : null}
    </div>
  );
}
