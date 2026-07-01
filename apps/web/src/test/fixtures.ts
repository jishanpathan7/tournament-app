import type { TournamentResponse } from "@tournament/api-client";

let seq = 0;

/** Build a TournamentResponse with sensible defaults for tests. */
export function makeTournament(overrides: Partial<TournamentResponse> = {}): TournamentResponse {
  seq += 1;
  return {
    id: overrides.id ?? `t-${seq}`,
    slug: overrides.slug ?? `tournament-${seq}`,
    name: overrides.name ?? `Tournament ${seq}`,
    sportKey: overrides.sportKey ?? "badminton",
    status: overrides.status ?? "draft",
    visibility: overrides.visibility ?? "private",
    startsAt: overrides.startsAt ?? null,
    endsAt: overrides.endsAt ?? null,
    settings: overrides.settings ?? {},
    drawPublishedAt: overrides.drawPublishedAt ?? null,
    schedulePublishedAt: overrides.schedulePublishedAt ?? null,
    resultsPublishedAt: overrides.resultsPublishedAt ?? null,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00Z",
  };
}
