"use client";

import type { MatchView } from "@tournament/api-client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  deriveMatchProgress,
  deriveTournamentStats,
} from "@/features/tournaments/dashboard/config";

export function StatisticsPanel({ matches }: { matches: MatchView[] }) {
  const progress = deriveMatchProgress(matches);
  const stats = deriveTournamentStats(matches);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Statistics</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Stat label="Matches played" value={`${progress.terminal} / ${progress.total}`} />
          <Stat label="Games recorded" value={String(stats.gamesPlayed)} />
          <Stat label="Walkovers" value={String(stats.walkovers)} />
          <Stat label="No-shows" value={String(stats.noShows)} />
        </dl>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border rounded-xl border px-3 py-2">
      <dt className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.16em]">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}
