"use client";

import type { MatchView, StageResponse } from "@tournament/api-client";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALL,
  courtOptions,
  groupOptions,
  type MatchQueueFilters,
  roundOptions,
  stageOptions,
  STATUS_OPTIONS,
} from "@/features/matches/config";

/** Search + stage/round/group/court/status controls for the Match Center queue. Round,
 * group, and court options only appear once the data actually has more than one value —
 * no point showing a single-option filter. */
export function MatchQueueFiltersBar({
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
  const rounds = roundOptions(matches);
  const groups = groupOptions(matches);
  const courts = courtOptions(matches);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative min-w-[200px] flex-1">
        <Search
          className="text-muted-foreground pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
          strokeWidth={2.25}
          aria-hidden
        />
        <Input
          type="search"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Search by participant name…"
          aria-label="Search matches"
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

      <Select value={filters.status} onValueChange={(status) => onChange({ ...filters, status })}>
        <SelectTrigger className="sm:w-40" aria-label="Filter by status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.stageId} onValueChange={(stageId) => onChange({ ...filters, stageId })}>
        <SelectTrigger className="sm:w-48" aria-label="Filter by stage">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All stages</SelectItem>
          {stageOptions(stages).map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {rounds.length > 1 ? (
        <Select value={filters.roundId} onValueChange={(roundId) => onChange({ ...filters, roundId })}>
          <SelectTrigger className="sm:w-40" aria-label="Filter by round">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All rounds</SelectItem>
            {rounds.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {groups.length > 1 ? (
        <Select value={filters.groupId} onValueChange={(groupId) => onChange({ ...filters, groupId })}>
          <SelectTrigger className="sm:w-40" aria-label="Filter by group">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All groups</SelectItem>
            {groups.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {courts.length > 0 ? (
        <Select value={filters.courtId} onValueChange={(courtId) => onChange({ ...filters, courtId })}>
          <SelectTrigger className="sm:w-40" aria-label="Filter by court">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All courts</SelectItem>
            {courts.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}
