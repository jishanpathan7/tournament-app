"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { MatchQueueFiltersBar } from "@/features/matches/components/match-queue-filters-bar";
import { ALL, type MatchQueueFilters } from "@/features/matches/config";
import type { MatchView, StageResponse } from "@tournament/api-client";

export function MatchQueueAdvancedFilters({
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
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        tone="ghost"
        size="sm"
        className="text-muted-foreground self-start"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        Advanced filters
      </Button>
      {open ? (
        <MatchQueueFiltersBar
          filters={filters}
          onChange={(next) => {
            if (next.stageId !== filters.stageId) {
              onChange({ ...next, roundId: ALL, groupId: ALL, courtId: ALL });
              return;
            }
            onChange(next);
          }}
          stages={stages}
          matches={matches}
        />
      ) : null}
    </div>
  );
}
