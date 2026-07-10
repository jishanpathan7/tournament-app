"use client";

import Link from "next/link";
import { Shuffle, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { countUnpairedFromReadiness } from "@/features/tournaments/dashboard/config";
import { DrawStatusSummary } from "@/features/tournaments/dashboard/components/draw-status-summary";
import { useSquads } from "@/features/squads/use-squads";
import type { useTournamentDashboard } from "@/features/tournaments/dashboard/use-tournament-dashboard";

type DashboardData = ReturnType<typeof useTournamentDashboard>;

export function BeforePanel({
  tournamentId,
  data,
  canManage,
}: {
  tournamentId: string;
  data: DashboardData;
  canManage: boolean;
}) {
  const divisions = data.divisions.data ?? [];
  const unpaired = data.readiness.data
    ? countUnpairedFromReadiness(data.readiness.data.divisions)
    : 0;
  const squads = useSquads(tournamentId);
  const unassignedTeams = squads.data?.summary.unassigned ?? 0;

  const hasContent =
    (canManage && (squads.data?.summary.squadCount ?? 0) === 0) ||
    (canManage && unassignedTeams > 0) ||
    unpaired > 0 ||
    divisions.length > 0;

  if (!hasContent) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {canManage && (squads.data?.summary.squadCount ?? 0) === 0 ? (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" strokeWidth={2.25} />
              Teams
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Split participants into franchise teams before doubles pairing or draw generation.
            </p>
            <Button asChild tone="paper" size="sm" className="mt-3">
              <Link href={`/console/tournaments/${tournamentId}/teams`}>Set up teams</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
      {canManage && unassignedTeams > 0 ? (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" strokeWidth={2.25} />
              Team assignment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {unassignedTeams} player{unassignedTeams === 1 ? "" : "s"} still need a team.
            </p>
            <Button asChild tone="paper" size="sm" className="mt-3">
              <Link href={`/console/tournaments/${tournamentId}/teams`}>Manage teams</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
      {unpaired > 0 ? (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shuffle className="h-5 w-5" strokeWidth={2.25} />
              Pairings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {unpaired} entrant{unpaired === 1 ? "" : "s"} still need pairing across divisions.
            </p>
            <Button asChild tone="paper" size="sm" className="mt-3">
              <Link href={`/console/tournaments/${tournamentId}`}>Open divisions below</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
      <DrawStatusSummary
        tournamentId={tournamentId}
        divisions={divisions}
        stagesByDivision={data.stagesByDivision}
        drawProgress={data.drawProgress}
      />
    </div>
  );
}
