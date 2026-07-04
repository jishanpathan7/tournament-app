"use client";

import { ChampionsPanel } from "@/features/tournaments/dashboard/components/champions-panel";
import { ReportsPanel } from "@/features/tournaments/dashboard/components/reports-panel";
import { StandingsSnapshot } from "@/features/tournaments/dashboard/components/standings-snapshot";
import { StatisticsPanel } from "@/features/tournaments/dashboard/components/statistics-panel";
import type { useTournamentDashboard } from "@/features/tournaments/dashboard/use-tournament-dashboard";
import type { TournamentResponse } from "@tournament/api-client";

type DashboardData = ReturnType<typeof useTournamentDashboard>;

export function AfterPanel({
  tournament,
  data,
  canManage,
}: {
  tournament: TournamentResponse;
  data: DashboardData;
  canManage: boolean;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChampionsPanel champions={data.champions} />
      <StatisticsPanel matches={data.matches.data ?? []} />
      <StandingsSnapshot
        tournamentId={tournament.id}
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
  );
}
