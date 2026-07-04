"use client";

import type { MatchView } from "@tournament/api-client";
import Link from "next/link";
import { Swords } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deriveMatchProgress } from "@/features/tournaments/dashboard/config";
import { countByStatus } from "@/features/matches/config";
import { MATCH_STATUS } from "@/features/draws/config";

export function LiveProgressPanel({
  tournamentId,
  matches,
}: {
  tournamentId: string;
  matches: MatchView[];
}) {
  const progress = deriveMatchProgress(matches);
  const counts = countByStatus(matches);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Swords className="h-5 w-5" strokeWidth={2.25} />
          Match progress
        </CardTitle>
        <Link
          href={`/console/tournaments/${tournamentId}/matches`}
          className="text-candy-dark text-sm font-semibold"
        >
          Match Center
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Completed</span>
            <span className="font-mono tabular-nums">
              {progress.terminal}/{progress.total} ({progress.pct}%)
            </span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className="bg-mint h-full rounded-full transition-all"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(counts).map(([status, count]) => (
            <span
              key={status}
              className="border-border rounded-lg border px-2 py-1 text-xs tabular-nums"
            >
              {MATCH_STATUS[status]?.label ?? status}: {count}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
