import type { TournamentResponse } from "@tournament/api-client";

/** Client-side list controls (GET /tournaments returns the full array, unpaginated). */

export type TournamentSort = "recent" | "oldest" | "name";
export const STATUS_FILTERS = [
  "all",
  "draft",
  "registration",
  "seeding",
  "live",
  "completed",
  "archived",
] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export interface TournamentFilters {
  search: string;
  status: StatusFilter;
  sort: TournamentSort;
}

export const DEFAULT_FILTERS: TournamentFilters = { search: "", status: "all", sort: "recent" };

/** Pure filter+sort — kept side-effect free so it can be unit-tested directly. */
export function applyTournamentFilters(
  tournaments: TournamentResponse[],
  filters: TournamentFilters,
): TournamentResponse[] {
  const q = filters.search.trim().toLowerCase();
  const filtered = tournaments.filter((t) => {
    if (filters.status !== "all" && t.status !== filters.status) return false;
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      t.slug.toLowerCase().includes(q) ||
      t.sportKey.toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    switch (filters.sort) {
      case "name":
        return a.name.localeCompare(b.name);
      case "oldest":
        return a.createdAt.localeCompare(b.createdAt);
      case "recent":
      default:
        return b.createdAt.localeCompare(a.createdAt);
    }
  });
  return sorted;
}

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
