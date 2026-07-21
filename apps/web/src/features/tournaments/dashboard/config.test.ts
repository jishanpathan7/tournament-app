import { describe, expect, it } from "vitest";

import {
  completedSteps,
  deriveAlerts,
  deriveChampions,
  deriveMatchProgress,
  deriveRegistrationTotals,
  deriveTournamentStats,
  getDashboardPhase,
} from "@/features/tournaments/dashboard/config";
import { makeParticipant, makeRegistration } from "@/test/fixtures";

describe("getDashboardPhase", () => {
  it("maps lifecycle statuses to phases", () => {
    expect(getDashboardPhase("draft")).toBe("before");
    expect(getDashboardPhase("registration")).toBe("before");
    expect(getDashboardPhase("seeding")).toBe("before");
    expect(getDashboardPhase("live")).toBe("during");
    expect(getDashboardPhase("completed")).toBe("after");
    expect(getDashboardPhase("archived")).toBe("after");
  });
});

describe("deriveMatchProgress", () => {
  it("counts terminal matches", () => {
    const progress = deriveMatchProgress([
      { status: "completed" } as never,
      { status: "scheduled" } as never,
      { status: "walkover" } as never,
    ]);
    expect(progress).toEqual({ total: 3, terminal: 2, pct: 67 });
  });
});

describe("deriveRegistrationTotals", () => {
  it("aggregates across divisions", () => {
    const regs = new Map([
      [
        "d1",
        [
          makeRegistration({ status: "submitted" }),
          makeRegistration({ status: "approved", participantId: "p1" }),
        ],
      ],
    ]);
    const parts = new Map([["d1", [makeParticipant({ id: "p1", status: "approved" })]]]);
    expect(deriveRegistrationTotals(regs, parts)).toEqual({
      approved: 1,
      pending: 1,
      waitlisted: 0,
      rejected: 0,
    });
  });
});

describe("deriveTournamentStats", () => {
  it("counts walkovers and games", () => {
    const stats = deriveTournamentStats([
      { status: "walkover", resultPayload: {} } as never,
      { status: "no_show", resultPayload: {} } as never,
      {
        status: "completed",
        resultPayload: {
          games: [
            [21, 15],
            [21, 10],
          ],
        },
      } as never,
    ]);
    expect(stats).toEqual({ walkovers: 1, noShows: 1, gamesPlayed: 2 });
  });
});

describe("deriveChampions", () => {
  it("picks rank-1 from highest drawn stage per division", () => {
    const divisions = [{ id: "d1", name: "MS Open" }] as never[];
    const stages = new Map([["d1", [{ id: "s1", seq: 0, drawn: true } as never]]]);
    const standings = new Map([
      [
        "s1",
        {
          stageId: "s1",
          rows: [{ participantId: "p-win", rank: 1 } as never],
        },
      ],
    ]);
    const participants = new Map([
      ["p-win", makeParticipant({ id: "p-win", displayName: "Alice" })],
    ]);

    expect(deriveChampions(divisions, stages, standings, participants)).toEqual([
      {
        divisionId: "d1",
        divisionName: "MS Open",
        stageId: "s1",
        participantId: "p-win",
        displayName: "Alice",
      },
    ]);
  });
});

describe("deriveAlerts", () => {
  const tournament = {
    id: "t1",
    status: "live",
    drawPublishedAt: null,
    resultsPublishedAt: null,
  } as never;

  it("surfaces delayed courts during live", () => {
    const alerts = deriveAlerts({
      tournament,
      matches: [],
      registrationTotals: { approved: 0, pending: 0, waitlisted: 0, rejected: 0 },
      drawProgress: { drawn: 0, total: 0 },
      queue: {
        courts: [{ isDelayed: true, court: { id: "c1" } } as never],
        unscheduled: [],
        pending: [],
      } as never,
    });
    expect(alerts.some((a) => a.id === "delayed-courts")).toBe(true);
  });
});

describe("completedSteps", () => {
  const none = {
    hasApproved: false,
    squadsReady: false,
    pairingPublished: false,
    checkInReady: false,
    drawComplete: false,
    courtsReady: false,
    franchiseMode: true,
  };

  it("marks work done even when it happened out of order", () => {
    // Teams built and paired before check-in. The checklist used to infer
    // completion from position, so both read as pending while the teams page
    // showed four full, paired teams.
    const done = completedSteps("registration", {
      ...none,
      hasApproved: true,
      squadsReady: true,
      pairingPublished: true,
    });
    expect(done.has(4)).toBe(true); // assign to teams
    expect(done.has(5)).toBe(true); // generate pairs
    expect(done.has(3)).toBe(false); // check-in genuinely still outstanding
  });

  it("does not mark anything beyond what the signals say", () => {
    const done = completedSteps("registration", none);
    expect([...done]).toEqual([1]); // only "event setup", implied by leaving draft
  });

  it("treats a draft tournament as having nothing finished", () => {
    expect([...completedSteps("draft", none)]).toEqual([]);
  });
});
