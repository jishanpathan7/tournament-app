"use client";

import { CourtStatusPanel } from "@/features/tournaments/dashboard/components/court-status-panel";
import { LiveProgressPanel } from "@/features/tournaments/dashboard/components/live-progress-panel";
import { StandingsSnapshot } from "@/features/tournaments/dashboard/components/standings-snapshot";
import { UpcomingMatchesPanel } from "@/features/tournaments/dashboard/components/upcoming-matches-panel";
import type { useTournamentDashboard } from "@/features/tournaments/dashboard/use-tournament-dashboard";

type DashboardData = ReturnType<typeof useTournamentDashboard>;

export function DuringPanel({
  tournamentId,
  data,
}: {
  tournamentId: string;
  data: DashboardData;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <LiveProgressPanel tournamentId={tournamentId} matches={data.matches.data ?? []} />
      <CourtStatusPanel tournamentId={tournamentId} />
      <UpcomingMatchesPanel
        tournamentId={tournamentId}
        queue={data.queue.data}
        participantsById={data.participantsById}
      />
      <StandingsSnapshot
        tournamentId={tournamentId}
        stages={data.stages.data ?? []}
        standingsByStage={data.standingsByStage}
        participantsById={data.participantsById}
      />
    </div>
  );
}
