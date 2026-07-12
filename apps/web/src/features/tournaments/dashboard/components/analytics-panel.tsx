"use client";

import type { StageResponse } from "@tournament/api-client";
import { BarChart3, Medal, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFranchiseStandings } from "@/features/franchise-ties/use-franchise-ties";
import { usePublicPlayerStats } from "@/features/public/use-public-tournament";
import { useTournament } from "@/features/tournaments/use-tournaments";

function TeamRankings({ stages }: { stages: StageResponse[] }) {
  const rrStage = stages.find((s) => s.type === "round_robin");
  const { data, isLoading } = useFranchiseStandings(rrStage?.id);

  if (!rrStage) return null;
  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;
  if (!data || data.rows.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4" strokeWidth={2.25} />
          Team Rankings
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {["#", "Team", "P", "W", "D", "L", "Pts"].map((h) => (
                  <th
                    key={h}
                    className="text-muted-foreground px-3 py-2 text-center font-mono text-xs font-semibold uppercase tracking-widest first:text-left"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr
                  key={row.squadName}
                  className={`border-b last:border-0 ${row.rank === 1 ? "bg-candy/10" : ""}`}
                >
                  <td className="px-3 py-2 text-center">
                    {row.rank === 1 ? (
                      <Medal className="mx-auto h-4 w-4 text-yellow-500" />
                    ) : (
                      <span className="text-muted-foreground font-mono text-xs">{row.rank}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-semibold">{row.squadName}</td>
                  <td className="text-muted-foreground px-3 py-2 text-center">{row.played}</td>
                  <td className="px-3 py-2 text-center font-semibold text-green-700">{row.won}</td>
                  <td className="text-muted-foreground px-3 py-2 text-center">{row.drawn}</td>
                  <td className="px-3 py-2 text-center text-red-600">{row.lost}</td>
                  <td className="px-3 py-2 text-center font-mono font-bold">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function TopPerformers({ slug }: { slug: string }) {
  const { data, isLoading } = usePublicPlayerStats(slug);

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;
  if (!data || data.rows.length === 0) return null;

  const top = data.rows.slice(0, 10);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" strokeWidth={2.25} />
          Top Performers
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {["#", "Player / Pair", "Team", "W", "L", "Win%"].map((h) => (
                  <th
                    key={h}
                    className="text-muted-foreground px-3 py-2 text-center font-mono text-xs font-semibold uppercase tracking-widest first:text-left"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {top.map((row, i) => (
                <tr key={row.participantId} className="border-b last:border-0">
                  <td className="text-muted-foreground px-3 py-2 text-center font-mono text-xs">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2 font-semibold">{row.displayName}</td>
                  <td className="px-3 py-2">
                    {row.squadName ? (
                      <Badge tone="candy">{row.squadName}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center font-semibold text-green-700">{row.won}</td>
                  <td className="px-3 py-2 text-center text-red-600">{row.lost}</td>
                  <td className="px-3 py-2 text-center font-mono text-xs font-semibold">
                    {(row.winRate * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function AnalyticsPanel({
  tournamentId,
  stages,
}: {
  tournamentId: string;
  stages: StageResponse[];
}) {
  const { data: tournament } = useTournament(tournamentId);

  const hasFranchiseStage = stages.some((s) => s.type === "round_robin");
  const hasSlug = !!tournament?.slug;

  if (!hasFranchiseStage && !hasSlug) return null;

  return (
    <div className="col-span-full grid gap-6 lg:grid-cols-2">
      <TeamRankings stages={stages} />
      {hasSlug ? <TopPerformers slug={tournament.slug} /> : null}
    </div>
  );
}
