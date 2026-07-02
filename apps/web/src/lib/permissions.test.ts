import { describe, expect, it } from "vitest";

import { ACTIONS, can } from "@/lib/permissions";

describe("can (authz mirror)", () => {
  it("grants owners everything, including org:delete", () => {
    expect(can("owner", ACTIONS.ORG_DELETE)).toBe(true);
    expect(can("owner", ACTIONS.TOURNAMENT_CREATE)).toBe(true);
  });

  it("denies admins only org:delete", () => {
    expect(can("admin", ACTIONS.ORG_DELETE)).toBe(false);
    expect(can("admin", ACTIONS.TOURNAMENT_UPDATE)).toBe(true);
  });

  it("lets organizers manage tournaments but not members", () => {
    expect(can("organizer", ACTIONS.TOURNAMENT_CREATE)).toBe(true);
    expect(can("organizer", ACTIONS.MEMBER_INVITE)).toBe(false);
  });

  it("restricts scorekeepers to scoring", () => {
    expect(can("scorekeeper", ACTIONS.SCORING_WRITE)).toBe(true);
    expect(can("scorekeeper", ACTIONS.TOURNAMENT_CREATE)).toBe(false);
  });

  it("lets organizers manage the schedule but not scorekeepers or viewers", () => {
    expect(can("organizer", ACTIONS.SCHEDULE_MANAGE)).toBe(true);
    expect(can("owner", ACTIONS.SCHEDULE_MANAGE)).toBe(true);
    expect(can("admin", ACTIONS.SCHEDULE_MANAGE)).toBe(true);
    expect(can("scorekeeper", ACTIONS.SCHEDULE_MANAGE)).toBe(false);
    expect(can("viewer", ACTIONS.SCHEDULE_MANAGE)).toBe(false);
  });

  it("gives viewers read-only", () => {
    expect(can("viewer", ACTIONS.ORG_READ)).toBe(true);
    expect(can("viewer", ACTIONS.TOURNAMENT_CREATE)).toBe(false);
  });

  it("default-denies null/unknown roles", () => {
    expect(can(null, ACTIONS.ORG_READ)).toBe(false);
    expect(can(undefined, ACTIONS.ORG_READ)).toBe(false);
  });
});
