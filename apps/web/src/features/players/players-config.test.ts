import { describe, expect, it } from "vitest";

import {
  buildPlayerRows,
  derivePlayerStats,
  filterPlayerRows,
  playerGender,
  playerInitials,
  playerRating,
} from "@/features/players/players-config";

describe("players-config", () => {
  it("derives initials from display name", () => {
    expect(playerInitials("Aarav Mehta")).toBe("AM");
    expect(playerInitials("Solo")).toBe("SO");
  });

  it("maps skill level to rating display", () => {
    expect(
      playerRating({
        id: "r1",
        divisionId: "d1",
        submittedBy: "u1",
        status: "approved",
        skillLevel: "advanced",
        participantId: null,
        formResponse: {},
        createdAt: "2026-01-01T00:00:00Z",
      }),
    ).toBe("1820");
  });

  it("normalizes gender from form response", () => {
    expect(
      playerGender({
        id: "r1",
        divisionId: "d1",
        submittedBy: "u1",
        status: "approved",
        skillLevel: null,
        participantId: null,
        formResponse: { gender: "male" },
        createdAt: "2026-01-01T00:00:00Z",
      }),
    ).toBe("M");
  });

  it("aggregates player stats", () => {
    const rows = buildPlayerRows(
      [
        {
          id: "d1",
          name: "Open",
          participantType: "individual",
          capacity: null,
          tournamentId: "t1",
          regForm: {},
          createdAt: "",
        },
      ],
      new Map([
        [
          "d1",
          [
            {
              id: "r1",
              divisionId: "d1",
              submittedBy: "u1",
              status: "approved",
              skillLevel: "advanced",
              participantId: "p1",
              formResponse: { name: "Aarav Mehta" },
              createdAt: "2026-01-01T00:00:00Z",
            },
            {
              id: "r2",
              divisionId: "d1",
              submittedBy: "u2",
              status: "submitted",
              skillLevel: null,
              participantId: null,
              formResponse: { name: "Pending Player" },
              createdAt: "2026-01-01T00:00:00Z",
            },
          ],
        ],
      ]),
      new Map([
        [
          "d1",
          [
            {
              id: "p1",
              divisionId: "d1",
              kind: "individual",
              displayName: "Aarav Mehta",
              status: "approved",
              attendance: "checked_in",
              checkedInAt: "2026-01-01T08:00:00Z",
              seed: null,
            },
          ],
        ],
      ]),
      new Map(),
    );

    expect(derivePlayerStats(rows)).toEqual({
      total: 2,
      confirmed: 1,
      checkedIn: 1,
      needsReview: 1,
    });

    expect(filterPlayerRows(rows, "aarav", "all")).toHaveLength(1);
  });
});
