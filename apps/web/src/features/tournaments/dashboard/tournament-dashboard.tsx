"use client";

import { ErrorState } from "@/components/common/error-state";
import { LoadingPanel } from "@/components/common/loading";
import { OverviewPanel } from "@/features/tournaments/components/detail/overview-panel";
import { DivisionsSection } from "@/features/tournaments/components/detail/divisions-section";
import { AfterPanel } from "@/features/tournaments/dashboard/components/after-panel";
import { ActivityFeedPanel } from "@/features/tournaments/dashboard/components/activity-feed-panel";
import { AlertsPanel } from "@/features/tournaments/dashboard/components/alerts-panel";
import { BeforePanel } from "@/features/tournaments/dashboard/components/before-panel";
import { DashboardStatRow } from "@/features/tournaments/dashboard/components/dashboard-stat-row";
import { DuringPanel } from "@/features/tournaments/dashboard/components/during-panel";
import { useTournamentDashboard } from "@/features/tournaments/dashboard/use-tournament-dashboard";
import { TOURNAMENT_STATUS } from "@/features/tournaments/config";
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";
import { ApiError } from "@/lib/problem";

export function TournamentDashboard({ tournamentId }: { tournamentId: string }) {
  const can = useCan();
  const canManage = can(ACTIONS.TOURNAMENT_UPDATE);
  const data = useTournamentDashboard(tournamentId);

  if (data.tournament.isLoading || data.isLoadingCore) {
    return <LoadingPanel label="Loading dashboard" />;
  }

  if (data.tournament.isError || !data.tournament.data) {
    const error = data.tournament.error;
    const notFound = error instanceof ApiError && error.isNotFound;
    return (
      <ErrorState
        error={error}
        onRetry={notFound ? undefined : () => data.tournament.refetch()}
        title={notFound ? "Tournament not found" : "Couldn't load dashboard"}
      />
    );
  }

  const tournament = data.tournament.data;
  const statusMeta = TOURNAMENT_STATUS[tournament.status as keyof typeof TOURNAMENT_STATUS];

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground text-sm">{statusMeta.description}</p>

      <DashboardStatRow stats={data.stats} />
      <AlertsPanel alerts={data.alerts} />

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {data.phase === "before" ? (
            <BeforePanel tournamentId={tournamentId} data={data} canManage={canManage} />
          ) : null}
          {data.phase === "during" ? (
            <DuringPanel tournamentId={tournamentId} data={data} />
          ) : null}
          {data.phase === "after" ? (
            <AfterPanel tournament={tournament} data={data} canManage={canManage} />
          ) : null}
        </div>
        <aside className="flex min-w-0 flex-col gap-6">
          <ActivityFeedPanel tournamentId={tournamentId} />
          <OverviewPanel tournament={tournament} />
        </aside>
      </div>

      <section id="divisions" className="flex flex-col gap-3 scroll-mt-8">
        <h2 className="font-serif text-xl font-semibold tracking-tight">Divisions</h2>
        <DivisionsSection tournamentId={tournamentId} canManage={canManage} />
      </section>
    </div>
  );
}
