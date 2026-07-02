import { describe, expect, it } from "vitest";

import {
  ALL,
  applyFixtureFilters,
  DEFAULT_FIXTURE_FILTERS,
  divisionCapacityLabel,
  fixtureBucket,
  formatDateRange,
  groupByBucket,
  isRegistrationOpen,
  participantName,
} from "@/features/public/config";
import { makeMatch, makePublicDivision, makePublicParticipant } from "@/test/fixtures";

describe("formatDateRange", () => {
  it("returns null when both dates are missing", () => {
    expect(formatDateRange(null, null)).toBeNull();
  });

  it("formats a single date when only one side is present", () => {
    expect(formatDateRange("2026-07-28T00:00:00Z", null)).toMatch(/Jul 28, 2026/);
  });

  it("formats a range when both differ", () => {
    expect(formatDateRange("2026-07-28T00:00:00Z", "2026-07-31T00:00:00Z")).toMatch(
      /Jul 28, 2026 – Jul 31, 2026/,
    );
  });

  it("collapses to a single date when start and end are the same day", () => {
    const result = formatDateRange("2026-07-28T00:00:00Z", "2026-07-28T00:00:00Z");
    expect(result).not.toMatch(/–/);
  });
});

describe("divisionCapacityLabel", () => {
  it("shows a fraction when capacity is set", () => {
    const division = makePublicDivision({ capacity: 32, approvedCount: 12 });
    expect(divisionCapacityLabel(division)).toBe("12 of 32 spots filled");
  });

  it("shows a plain count when there's no capacity limit", () => {
    const division = makePublicDivision({ capacity: null, approvedCount: 12 });
    expect(divisionCapacityLabel(division)).toBe("12 registered");
  });
});

describe("isRegistrationOpen", () => {
  it("is true only for the registration status", () => {
    expect(isRegistrationOpen("registration")).toBe(true);
    expect(isRegistrationOpen("draft")).toBe(false);
    expect(isRegistrationOpen("live")).toBe(false);
  });
});

describe("participantName", () => {
  const p1 = makePublicParticipant({ id: "p-1", displayName: "Aarav K." });
  const participantsById = new Map([[p1.id, p1]]);

  it("resolves a known participant", () => {
    expect(participantName("p-1", participantsById)).toBe("Aarav K.");
  });

  it("falls back to TBD for a missing id", () => {
    expect(participantName(null, participantsById)).toBe("TBD");
  });

  it("falls back to Unknown for an id not in the map", () => {
    expect(participantName("p-999", participantsById)).toBe("Unknown");
  });
});

describe("applyFixtureFilters", () => {
  const p1 = makePublicParticipant({ id: "p-1", displayName: "Aarav K." });
  const p2 = makePublicParticipant({ id: "p-2", displayName: "Mei L." });
  const participantsById = new Map([
    [p1.id, p1],
    [p2.id, p2],
  ]);
  const side = (id: string) => ({
    participantId: id,
    outcome: null,
    scoreFor: null,
    scoreAgainst: null,
    rank: null,
  });

  const matches = [
    makeMatch({ id: "m-1", stageId: "stage-1", roundId: "r-1", sides: [side("p-1"), side("p-2")] }),
    makeMatch({ id: "m-2", stageId: "stage-2", roundId: "r-2", sides: [side("p-2"), side("p-1")] }),
  ];

  it("returns everything when filters are default", () => {
    expect(applyFixtureFilters(matches, DEFAULT_FIXTURE_FILTERS, participantsById)).toHaveLength(2);
  });

  it("filters by stage", () => {
    const result = applyFixtureFilters(
      matches,
      { ...DEFAULT_FIXTURE_FILTERS, stageId: "stage-1" },
      participantsById,
    );
    expect(result.map((m) => m.id)).toEqual(["m-1"]);
  });

  it("filters by search across participant names", () => {
    const result = applyFixtureFilters(
      matches,
      { ...DEFAULT_FIXTURE_FILTERS, search: "aarav" },
      participantsById,
    );
    expect(result.map((m) => m.id)).toEqual(["m-1", "m-2"]);
  });

  it("ALL constant matches the default filter values", () => {
    expect(DEFAULT_FIXTURE_FILTERS.stageId).toBe(ALL);
    expect(DEFAULT_FIXTURE_FILTERS.roundId).toBe(ALL);
  });
});

describe("fixtureBucket", () => {
  const now = new Date("2026-07-29T12:00:00Z");

  it("buckets terminal statuses as completed regardless of schedule", () => {
    expect(fixtureBucket(makeMatch({ status: "completed" }), now)).toBe("completed");
    expect(fixtureBucket(makeMatch({ status: "walkover" }), now)).toBe("completed");
  });

  it("buckets a same-day scheduled match as today", () => {
    const match = makeMatch({ status: "scheduled", scheduledAt: "2026-07-29T18:00:00Z" });
    expect(fixtureBucket(match, now)).toBe("today");
  });

  it("buckets everything else as upcoming", () => {
    expect(fixtureBucket(makeMatch({ status: "scheduled", scheduledAt: null }), now)).toBe(
      "upcoming",
    );
    expect(fixtureBucket(makeMatch({ status: "pending" }), now)).toBe("upcoming");
  });
});

describe("groupByBucket", () => {
  it("partitions matches into today/upcoming/completed", () => {
    const now = new Date("2026-07-29T12:00:00Z");
    const matches = [
      makeMatch({ id: "m-1", status: "completed" }),
      makeMatch({ id: "m-2", status: "scheduled", scheduledAt: "2026-07-29T18:00:00Z" }),
      makeMatch({ id: "m-3", status: "pending" }),
    ];
    const buckets = groupByBucket(matches, now);
    expect(buckets.completed.map((m) => m.id)).toEqual(["m-1"]);
    expect(buckets.today.map((m) => m.id)).toEqual(["m-2"]);
    expect(buckets.upcoming.map((m) => m.id)).toEqual(["m-3"]);
  });
});
