"use client";

import { BarChart3 } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicPlayerStats } from "@/features/public/use-public-tournament";

export function PublicPlayerStats({ slug }: { slug: string }) {
  const { data, isLoading, isError, error, refetch } = usePublicPlayerStats(slug);

  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data || data.rows.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No stats yet"
        description="Stats appear once matches are completed."
        className="py-16"
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" strokeWidth={2.25} />
          Player Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-muted-foreground px-3 py-2 text-left font-mono text-xs font-semibold uppercase tracking-widest sm:px-4">
                  #
                </th>
                <th className="text-muted-foreground px-3 py-2 text-left font-mono text-xs font-semibold uppercase tracking-widest sm:px-4">
                  Player / Pair
                </th>
                <th className="text-muted-foreground px-3 py-2 text-left font-mono text-xs font-semibold uppercase tracking-widest sm:px-4">
                  Team
                </th>
                <th className="text-muted-foreground px-3 py-2 text-center font-mono text-xs font-semibold uppercase tracking-widest sm:px-4">
                  P
                </th>
                <th className="text-muted-foreground px-3 py-2 text-center font-mono text-xs font-semibold uppercase tracking-widest sm:px-4">
                  W
                </th>
                <th className="text-muted-foreground px-3 py-2 text-center font-mono text-xs font-semibold uppercase tracking-widest sm:px-4">
                  L
                </th>
                <th className="text-muted-foreground px-3 py-2 text-center font-mono text-xs font-semibold uppercase tracking-widest sm:px-4">
                  Win%
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={row.participantId} className="border-b last:border-0">
                  <td className="text-muted-foreground px-3 py-2.5 text-center font-mono text-xs sm:px-4 sm:py-3">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2.5 font-semibold sm:px-4 sm:py-3">{row.displayName}</td>
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                    {row.squadName ? (
                      <Badge tone="candy">{row.squadName}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="text-muted-foreground px-3 py-2.5 text-center sm:px-4 sm:py-3">
                    {row.played}
                  </td>
                  <td className="px-3 py-2.5 text-center font-semibold text-green-700 sm:px-4 sm:py-3">
                    {row.won}
                  </td>
                  <td className="px-3 py-2.5 text-center text-red-600 sm:px-4 sm:py-3">
                    {row.lost}
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono text-xs font-semibold sm:px-4 sm:py-3">
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
