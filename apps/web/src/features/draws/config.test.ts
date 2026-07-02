import { describe, expect, it } from "vitest";

import {
  drawStatusFlags,
  evaluateDrawReadiness,
  groupMatchesByGroup,
  groupMatchesByRound,
  matchStatusMeta,
} from "@/features/draws/config";
import { makeMatch, makeStage, makeTournament } from "@/test/fixtures";

describe("evaluateDrawReadiness", () => {
  it("blocks when there aren't enough approved participants", () => {
    const readiness = evaluateDrawReadiness({
      approvedCount: 1,
      format: "round_robin",
      alreadyDrawn: false,
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.reasons).toHaveLength(1);
  });

  it("blocks when the stage is already drawn", () => {
    const readiness = evaluateDrawReadiness({
      approvedCount: 8,
      format: "round_robin",
      alreadyDrawn: true,
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.reasons[0]).toMatch(/already has a draw/);
  });

  it("is ready with no warnings for an even round robin field", () => {
    const readiness = evaluateDrawReadiness({
      approvedCount: 4,
      format: "round_robin",
      alreadyDrawn: false,
    });
    expect(readiness.ready).toBe(true);
    expect(readiness.warnings).toHaveLength(0);
  });

  it("warns about a sit-out round for an odd round robin field", () => {
    const readiness = evaluateDrawReadiness({
      approvedCount: 5,
      format: "round_robin",
      alreadyDrawn: false,
    });
    expect(readiness.ready).toBe(true);
    expect(readiness.warnings).toHaveLength(1);
  });

  it("warns about byes for a non-power-of-two single elimination field", () => {
    const readiness = evaluateDrawReadiness({
      approvedCount: 5,
      format: "single_elim",
      alreadyDrawn: false,
    });
    expect(readiness.warnings.some((w) => w.includes("bye"))).toBe(true);
  });

  it("has no bye warning for an exact power-of-two single elimination field", () => {
    const readiness = evaluateDrawReadiness({
      approvedCount: 8,
      format: "single_elim",
      alreadyDrawn: false,
    });
    expect(readiness.warnings).toHaveLength(0);
  });
});

describe("drawStatusFlags", () => {
  it("reads each flag from its own source field", () => {
    const stage = makeStage({ drawn: true, locked: true });
    const tournament = makeTournament({ drawPublishedAt: "2026-06-01T00:00:00Z", status: "live" });
    expect(drawStatusFlags(stage, tournament)).toEqual({
      generated: true,
      published: true,
      locked: true,
      live: true,
    });
  });

  it("defaults everything false for a fresh, unpublished, draft stage", () => {
    const stage = makeStage({ drawn: false, locked: false });
    const tournament = makeTournament({ drawPublishedAt: null, status: "draft" });
    expect(drawStatusFlags(stage, tournament)).toEqual({
      generated: false,
      published: false,
      locked: false,
      live: false,
    });
  });
});

describe("groupMatchesByRound", () => {
  it("groups by roundId and orders by roundSeq", () => {
    const final = makeMatch({ roundId: "r2", roundSeq: 2, roundLabel: "Final" });
    const semi1 = makeMatch({ roundId: "r1", roundSeq: 1, roundLabel: "Semifinal" });
    const semi2 = makeMatch({ roundId: "r1", roundSeq: 1, roundLabel: "Semifinal" });

    const groups = groupMatchesByRound([final, semi1, semi2]);
    expect(groups.map((g) => g.label)).toEqual(["Semifinal", "Final"]);
    expect(groups[0]!.matches).toHaveLength(2);
    expect(groups[1]!.matches).toHaveLength(1);
  });

  it("falls back to a stable label/key when a match has no round", () => {
    const groups = groupMatchesByRound([makeMatch({ roundId: null, roundLabel: null })]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.label).toBe("Round");
  });
});

describe("groupMatchesByGroup", () => {
  it("groups by groupId, ordered alphabetically by label", () => {
    const poolB = makeMatch({ groupId: "g2", groupName: "Pool B" });
    const poolA = makeMatch({ groupId: "g1", groupName: "Pool A" });
    const groups = groupMatchesByGroup([poolB, poolA]);
    expect(groups.map((g) => g.label)).toEqual(["Pool A", "Pool B"]);
  });
});

describe("matchStatusMeta", () => {
  it("returns known status metadata", () => {
    expect(matchStatusMeta("completed").label).toBe("Completed");
  });

  it("falls back gracefully for an unknown status", () => {
    expect(matchStatusMeta("mystery").label).toBe("mystery");
  });
});
