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
import { REGISTRATION_STATUS_FILTERS, statusMeta } from "@/features/registrations/config";
import type { RegistrationFilters, RegistrationSort } from "@/features/registrations/filter";

const SORT_LABELS: Record<RegistrationSort, string> = {
  recent: "Newest first",
  oldest: "Oldest first",
};

/** Search + status + sort controls for the registration queue. Fully keyboard-operable. */
export function RegistrationFiltersBar({
  filters,
  onChange,
}: {
  filters: RegistrationFilters;
  onChange: (next: RegistrationFilters) => void;
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
          placeholder="Search by name, email, team…"
          aria-label="Search registrations"
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
        onValueChange={(status) =>
          onChange({ ...filters, status: status as RegistrationFilters["status"] })
        }
      >
        <SelectTrigger className="sm:w-44" aria-label="Filter by status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {REGISTRATION_STATUS_FILTERS.map((s) => (
            <SelectItem key={s} value={s}>
              {s === "all" ? "All statuses" : statusMeta(s).label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.sort}
        onValueChange={(sort) => onChange({ ...filters, sort: sort as RegistrationSort })}
      >
        <SelectTrigger className="sm:w-40" aria-label="Sort registrations">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SORT_LABELS) as RegistrationSort[]).map((s) => (
            <SelectItem key={s} value={s}>
              {SORT_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
