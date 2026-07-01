"use client";

import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TOURNAMENT_STATUS } from "@/features/tournaments/config";
import {
  STATUS_FILTERS,
  type StatusFilter,
  type TournamentFilters,
  type TournamentSort,
} from "@/features/tournaments/filter";

const SORT_LABELS: Record<TournamentSort, string> = {
  recent: "Newest first",
  oldest: "Oldest first",
  name: "Name (A–Z)",
};

/** Search + status + sort controls for the tournament list. Fully keyboard-operable. */
export function TournamentFiltersBar({
  filters,
  onChange,
}: {
  filters: TournamentFilters;
  onChange: (next: TournamentFilters) => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search
          className="text-muted-foreground pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
          strokeWidth={2.25}
          aria-hidden
        />
        <Input
          type="search"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Search tournaments…"
          aria-label="Search tournaments"
          className="h-10 pl-10 pr-9"
        />
        {filters.search ? (
          <button
            type="button"
            onClick={() => onChange({ ...filters, search: "" })}
            aria-label="Clear search"
            className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        ) : null}
      </div>

      <Select
        value={filters.status}
        onValueChange={(status) => onChange({ ...filters, status: status as StatusFilter })}
      >
        <SelectTrigger className="sm:w-44" aria-label="Filter by status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_FILTERS.map((s) => (
            <SelectItem key={s} value={s}>
              {s === "all" ? "All statuses" : TOURNAMENT_STATUS[s].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.sort}
        onValueChange={(sort) => onChange({ ...filters, sort: sort as TournamentSort })}
      >
        <SelectTrigger className="sm:w-44" aria-label="Sort tournaments">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SORT_LABELS) as TournamentSort[]).map((s) => (
            <SelectItem key={s} value={s}>
              {SORT_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
