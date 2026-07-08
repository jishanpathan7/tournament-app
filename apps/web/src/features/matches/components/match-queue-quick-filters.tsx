"use client";

import {
  QUICK_FILTER_OPTIONS,
  type MatchQueueFilters,
  type QuickFilter,
} from "@/features/matches/config";
import { cn } from "@/lib/utils";

export function MatchQueueQuickFilters({
  filters,
  onChange,
}: {
  filters: MatchQueueFilters;
  onChange: (next: MatchQueueFilters) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {QUICK_FILTER_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange({ ...filters, quick: opt.value as QuickFilter })}
          className={cn(
            "text-2xs shrink-0 rounded-full border-2 px-3 py-1 font-mono font-semibold uppercase tracking-[0.14em] transition-colors",
            filters.quick === opt.value
              ? "border-ink bg-ink text-white"
              : "border-ink/20 hover:border-ink/40",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
