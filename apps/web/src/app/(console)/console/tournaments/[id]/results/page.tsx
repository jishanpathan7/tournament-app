"use client";

import { use } from "react";

import { ErrorState } from "@/components/common/error-state";
import { LoadingPanel } from "@/components/common/loading";
import { ChampionsPanel } from "@/features/tournaments/dashboard/components/champions-panel";
import { ReportsPanel } from "@/features/tournaments/dashboard/components/reports-panel";
import { StandingsSnapshot } from "@/features/tournaments/dashboard/components/standings-snapshot";
import { StatisticsPanel } from "@/features/tournaments/dashboard/components/statistics-panel";
import { useTournamentDashboard } from "@/features/tournaments/dashboard/use-tournament-dashboard";
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";
import { ApiError } from "@/lib/problem";

export default function TournamentResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const can = useCan();
  const canManage = can(ACTIONS.TOURNAMENT_UPDATE);
  const data = useTournamentDashboard(id);

  if (data.tournament.isLoading || data.isLoadingCore) {
    return <LoadingPanel label="Loading results" />;
  }

  if (data.tournament.isError || !data.tournament.data) {
    const error = data.tournament.error;
    const notFound = error instanceof ApiError && error.isNotFound;
    return (
      <ErrorState
        error={error}
        onRetry={notFound ? undefined : () => data.tournament.refetch()}
        title={notFound ? "Tournament not found" : "Couldn't load results"}
      />
    );
  }

  const tournament = data.tournament.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-serif text-xl font-semibold tracking-tight">Results</h2>
        <p className="text-muted-foreground text-sm">
          Final standings, champions, and match statistics.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChampionsPanel champions={data.champions} />
        <StatisticsPanel matches={data.matches.data ?? []} />
        <StandingsSnapshot
          tournamentId={id}
          stages={data.stages.data ?? []}
          standingsByStage={data.standingsByStage}
          participantsById={data.participantsById}
        />
        <ReportsPanel
          tournament={tournament}
          divisions={data.divisions.data ?? []}
          canManage={canManage}
        />
      </div>
    </div>
  );
}
