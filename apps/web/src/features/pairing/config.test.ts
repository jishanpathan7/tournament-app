import { describe, expect, it } from "vitest";

import {
  confidenceMeta,
  entrantName,
  entrantsById,
  pairingStats,
  skillMeta,
  sortedTeams,
} from "@/features/pairing/config";
import { makeEntrant, makePairingRun, makeProposedTeam } from "@/test/fixtures";

describe("skillMeta", () => {
  it("maps known tiers", () => {
    expect(skillMeta("advanced").label).toBe("Advanced");
    expect(skillMeta("beginner").tone).toBe("mint");
  });

  it("falls back for unknown / missing skill", () => {
    expect(skillMeta(null).label).toBe("Unrated");
    expect(skillMeta("pro").label).toBe("pro");
  });
});

describe("confidenceMeta", () => {
  it("bands confidence into tone + percentage", () => {
    expect(confidenceMeta(1)).toMatchObject({ label: "Balanced", tone: "mint", pct: 100 });
    expect(confidenceMeta(0.7)).toMatchObject({ label: "Fair", tone: "candy" });
    expect(confidenceMeta(0.4)).toMatchObject({ label: "Uneven", tone: "yellow" });
    expect(confidenceMeta(0.1)).toMatchObject({ label: "Lopsided", tone: "pink", pct: 10 });
  });
});

describe("entrant lookups", () => {
  const run = makePairingRun({
    entrants: [
      makeEntrant({ registrationId: "a", displayName: "Aarav" }),
      makeEntrant({ registrationId: "b", displayName: "Mei" }),
    ],
  });

  it("indexes entrants by id", () => {
    expect(entrantsById(run).get("a")?.displayName).toBe("Aarav");
  });

  it("resolves a member name, or 'Unknown' when absent", () => {
    expect(entrantName(run, "b")).toBe("Mei");
    expect(entrantName(run, "missing")).toBe("Unknown");
  });
});

describe("sortedTeams", () => {
  it("puts locked teams first, then lowest confidence first", () => {
    const run = makePairingRun({
      teams: [
        makeProposedTeam({ id: "t1", confidence: 0.9, locked: false }),
        makeProposedTeam({ id: "t2", confidence: 0.4, locked: false }),
        makeProposedTeam({ id: "t3", confidence: 0.2, locked: true }),
      ],
    });
    expect(sortedTeams(run).map((t) => t.id)).toEqual(["t3", "t2", "t1"]);
  });
});

describe("pairingStats", () => {
  it("derives counts + locked total from the run", () => {
    const run = makePairingRun({
      teams: [
        makeProposedTeam({ locked: true }),
        makeProposedTeam({ locked: false }),
      ],
      unpairedIds: ["x"],
      summary: {
        teamCount: 2,
        entrantCount: 5,
        unpairedCount: 1,
        averageConfidence: 0.8,
      },
    });
    const stats = pairingStats(run);
    expect(stats.teamCount).toBe(2);
    expect(stats.unpairedCount).toBe(1);
    expect(stats.lockedCount).toBe(1);
    expect(stats.averageConfidence).toBe(0.8);
  });
});
