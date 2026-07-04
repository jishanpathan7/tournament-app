import type { MemberItem, RegistrationResponse } from "@tournament/api-client";

import type { RegistrationStatusFilter } from "@/features/registrations/config";

export type RegistrationSort = "recent" | "oldest";

export interface RegistrationFilters {
  search: string;
  status: RegistrationStatusFilter;
  sort: RegistrationSort;
}

export const DEFAULT_REGISTRATION_FILTERS: RegistrationFilters = {
  search: "",
  status: "all",
  sort: "recent",
};

/**
 * Pure filter+sort — kept side-effect free so it's unit-testable. Search matches the
 * submitter's name/email (resolved via the org members map — registrations don't carry
 * a name themselves), the skill level, or anything in the submitted `formResponse`
 * (team name, player names) without assuming its shape.
 */
export function applyRegistrationFilters(
  registrations: RegistrationResponse[],
  filters: RegistrationFilters,
  membersById: Map<string, MemberItem>,
): RegistrationResponse[] {
  const q = filters.search.trim().toLowerCase();
  const filtered = registrations.filter((r) => {
    if (filters.status !== "all" && r.status !== filters.status) return false;
    if (!q) return true;
    const member = membersById.get(r.submittedBy);
    const haystack = [
      typeof r.formResponse?.name === "string" ? r.formResponse.name : "",
      member?.name ?? "",
      member?.email ?? "",
      r.skillLevel ?? "",
      JSON.stringify(r.formResponse ?? {}),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });

  const sorted = [...filtered];
  sorted.sort((a, b) =>
    filters.sort === "oldest"
      ? a.createdAt.localeCompare(b.createdAt)
      : b.createdAt.localeCompare(a.createdAt),
  );
  return sorted;
}
