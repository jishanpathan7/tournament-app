"use client";

import { Card, CardContent } from "@/components/ui/card";
import { MatchQueueAdvancedFilters } from "@/features/matches/components/match-queue-advanced-filters";
import { MatchQueueQuickFilters } from "@/features/matches/components/match-queue-quick-filters";
import type { MatchQueueFilters } from "@/features/matches/config";
import type { MatchView, StageResponse } from "@tournament/api-client";

/** Quick chips + collapsible advanced filters in one bordered panel. */
export function MatchQueueFiltersPanel({
  filters,
  onChange,
  stages,
  matches,
}: {
  filters: MatchQueueFilters;
  onChange: (next: MatchQueueFilters) => void;
  stages: StageResponse[];
  matches: MatchView[];
}) {
  return (
    <Card className="border-ink shadow-sticker-xs border-2">
      <CardContent className="flex flex-col gap-4 p-4 md:p-5">
        <MatchQueueQuickFilters filters={filters} onChange={onChange} />
        <MatchQueueAdvancedFilters
          filters={filters}
          onChange={onChange}
          stages={stages}
          matches={matches}
        />
      </CardContent>
    </Card>
  );
}
