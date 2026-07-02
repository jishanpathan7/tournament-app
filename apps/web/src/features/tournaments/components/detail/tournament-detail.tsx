"use client";

import { ArrowLeft, Pencil, Swords } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ErrorState } from "@/components/common/error-state";
import { LoadingPanel } from "@/components/common/loading";
import { Button } from "@/components/ui/button";
import { DivisionsSection } from "@/features/tournaments/components/detail/divisions-section";
import { EditTournamentDialog } from "@/features/tournaments/components/detail/edit-tournament-dialog";
import { OverviewPanel } from "@/features/tournaments/components/detail/overview-panel";
import { TournamentActions } from "@/features/tournaments/components/detail/tournament-actions";
import { TournamentStatusBadge } from "@/features/tournaments/components/tournament-status-badge";
import { getSport } from "@/features/tournaments/config";
import { useTournament } from "@/features/tournaments/use-tournaments";
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";
import { ApiError } from "@/lib/problem";

export function TournamentDetail({ id }: { id: string }) {
  const { data: tournament, isLoading, isError, error, refetch } = useTournament(id);
  const can = useCan();
  const canManage = can(ACTIONS.TOURNAMENT_UPDATE);
  const [editOpen, setEditOpen] = useState(false);

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

  const sport = getSport(tournament.sportKey);

  return (
    <div className="flex flex-col gap-6">
      <Button asChild tone="ghost" size="sm" className="text-muted-foreground -ml-2 self-start">
        <Link href="/console/tournaments">
          <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
          Tournaments
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
        <div className="flex items-center gap-2">
          <Button asChild tone="paper" size="sm">
            <Link href={`/console/tournaments/${tournament.id}/matches`}>
              <Swords className="h-4 w-4" strokeWidth={2.25} />
              Match Center
            </Link>
          </Button>
          {canManage ? (
            <Button tone="paper" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" strokeWidth={2.25} />
              Edit
            </Button>
          ) : null}
          <TournamentActions tournament={tournament} />
        </div>
      </div>

      <OverviewPanel tournament={tournament} />

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-xl font-semibold tracking-tight">Divisions</h2>
        <DivisionsSection tournamentId={tournament.id} canManage={canManage} />
      </section>

      {canManage ? (
        <EditTournamentDialog tournament={tournament} open={editOpen} onOpenChange={setEditOpen} />
      ) : null}
    </div>
  );
}
