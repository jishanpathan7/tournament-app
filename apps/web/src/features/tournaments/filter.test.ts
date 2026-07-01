import { describe, expect, it } from "vitest";

import { STATUS_TRANSITIONS } from "@/features/tournaments/config";
import { applyTournamentFilters, paginate } from "@/features/tournaments/filter";
import { makeTournament } from "@/test/fixtures";

describe("applyTournamentFilters", () => {
  const tournaments = [
    makeTournament({ name: "Spring Open", status: "live", createdAt: "2026-03-01T00:00:00Z" }),
    makeTournament({ name: "Winter Cup", status: "draft", createdAt: "2026-01-01T00:00:00Z" }),
    makeTournament({
      name: "Autumn Clash",
      status: "completed",
      createdAt: "2026-02-01T00:00:00Z",
    }),
  ];

  it("filters by search across name (case-insensitive)", () => {
    const result = applyTournamentFilters(tournaments, {
      search: "cup",
      status: "all",
      sort: "recent",
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Winter Cup");
  });

  it("filters by status", () => {
    const result = applyTournamentFilters(tournaments, {
      search: "",
      status: "live",
      sort: "recent",
    });
    expect(result.map((t) => t.name)).toEqual(["Spring Open"]);
  });

  it("sorts by most recent by default", () => {
    const result = applyTournamentFilters(tournaments, {
      search: "",
      status: "all",
      sort: "recent",
    });
    expect(result.map((t) => t.name)).toEqual(["Spring Open", "Autumn Clash", "Winter Cup"]);
  });

  it("sorts by name A–Z", () => {
    const result = applyTournamentFilters(tournaments, { search: "", status: "all", sort: "name" });
    expect(result.map((t) => t.name)).toEqual(["Autumn Clash", "Spring Open", "Winter Cup"]);
  });

  it("returns empty when nothing matches", () => {
    const result = applyTournamentFilters(tournaments, {
      search: "zzz",
      status: "all",
      sort: "recent",
    });
    expect(result).toEqual([]);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 25 }, (_, i) => i);
  it("slices the requested page", () => {
    expect(paginate(items, 1, 10)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(paginate(items, 3, 10)).toEqual([20, 21, 22, 23, 24]);
  });
});

describe("STATUS_TRANSITIONS (backend mirror)", () => {
  it("matches the backend lifecycle map", () => {
    expect(STATUS_TRANSITIONS.draft.map((t) => t.to)).toEqual(["registration"]);
    expect(STATUS_TRANSITIONS.registration.map((t) => t.to)).toEqual(["seeding", "draft"]);
    expect(STATUS_TRANSITIONS.live.map((t) => t.to)).toEqual(["completed"]);
    expect(STATUS_TRANSITIONS.completed.map((t) => t.to)).toEqual(["archived"]);
    expect(STATUS_TRANSITIONS.archived).toEqual([]);
  });
});
