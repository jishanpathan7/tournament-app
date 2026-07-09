"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { MatchQueueFiltersBar } from "@/features/matches/components/match-queue-filters-bar";
import { ALL, type MatchQueueFilters } from "@/features/matches/config";
import type { MatchView, StageResponse } from "@tournament/api-client";
import { cn } from "@/lib/utils";

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
    <div className="border-ink/10 flex flex-col border-t pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="hover:bg-muted/40 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors"
      >
        <span className="border-ink/20 bg-card flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border">
          <ChevronDown
            className={cn(
              "text-muted-foreground h-4 w-4 transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </span>
        <span className="text-sm font-semibold">Advanced filters</span>
        <span className="text-muted-foreground text-2xs ml-auto font-mono uppercase tracking-[0.14em]">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open ? (
        <div className="mt-3 flex flex-col gap-3 pl-2 md:pl-11">
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
        </div>
      ) : null}
    </div>
  );
}
