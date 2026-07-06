"use client";

import { Trophy } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFranchiseStandings } from "@/features/franchise-ties/use-franchise-ties";
import { cn } from "@/lib/utils";

export function SquadStandings({ stageId }: { stageId: string }) {
  const { data, isLoading, isError, error, refetch } = useFranchiseStandings(stageId);

  if (isLoading) return <Skeleton className="h-48 rounded-2xl" />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data || data.rows.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="No standings yet"
        description="Standings update as ties are completed."
        className="py-10"
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="text-candy-dark h-4 w-4" strokeWidth={2.25} />
          Team Standings
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-muted-foreground px-4 py-2 text-left font-mono text-xs font-semibold uppercase tracking-widest">
                  #
                </th>
                <th className="text-muted-foreground px-4 py-2 text-left font-mono text-xs font-semibold uppercase tracking-widest">
                  Team
                </th>
                <th className="text-muted-foreground px-4 py-2 text-center font-mono text-xs font-semibold uppercase tracking-widest">
                  P
                </th>
                <th className="text-muted-foreground px-4 py-2 text-center font-mono text-xs font-semibold uppercase tracking-widest">
                  W
                </th>
                <th className="text-muted-foreground px-4 py-2 text-center font-mono text-xs font-semibold uppercase tracking-widest">
                  D
                </th>
                <th className="text-muted-foreground px-4 py-2 text-center font-mono text-xs font-semibold uppercase tracking-widest">
                  L
                </th>
                <th className="text-muted-foreground px-4 py-2 text-center font-mono text-xs font-semibold uppercase tracking-widest">
                  Legs
                </th>
                <th className="text-muted-foreground px-4 py-2 text-center font-mono text-xs font-semibold uppercase tracking-widest">
                  Pts
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr
                  key={row.squadName}
                  className={cn(
                    "border-b last:border-0",
                    i === 0 && "bg-candy-tint",
                  )}
                >
                  <td className="px-4 py-3 text-center">
                    {i === 0 ? (
                      <Trophy className="text-candy-dark mx-auto h-4 w-4" strokeWidth={2.25} />
                    ) : (
                      <span className="text-muted-foreground font-mono text-xs">{row.rank}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold">{row.squadName}</td>
                  <td className="text-muted-foreground px-4 py-3 text-center">{row.played}</td>
                  <td className="px-4 py-3 text-center font-semibold text-green-700">{row.won}</td>
                  <td className="text-muted-foreground px-4 py-3 text-center">{row.drawn}</td>
                  <td className="px-4 py-3 text-center text-red-600">{row.lost}</td>
                  <td className="text-muted-foreground px-4 py-3 text-center font-mono text-xs">
                    {row.legWins}–{row.legLosses}
                  </td>
                  <td className="px-4 py-3 text-center font-bold">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
