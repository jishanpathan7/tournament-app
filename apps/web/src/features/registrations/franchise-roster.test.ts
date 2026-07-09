import { describe, expect, it } from "vitest";

import {
  competitorsForDraw,
  countApprovedPlayers,
  countCompetitorParticipants,
  isFranchisePairedDivision,
  playersForCheckIn,
} from "@/features/registrations/franchise-roster";
import { makeParticipant, makeRegistration } from "@/test/fixtures";

describe("franchise-roster", () => {
  const players = Array.from({ length: 53 }, (_, i) =>
    makeRegistration({ id: `r-${i}`, status: "approved", formResponse: { name: `Player ${i}` } }),
  );
  const individuals = players.map((r, i) =>
    makeParticipant({ id: `ind-${i}`, kind: "individual", displayName: `Player ${i}` }),
  );
  const pairs = Array.from({ length: 28 }, (_, i) =>
    makeParticipant({
      id: `pair-${i}`,
      kind: "pair",
      displayName: `Pair ${i}`,
      teamId: `team-${i}`,
    }),
  );
  const squads = Array.from({ length: 4 }, (_, i) =>
    makeParticipant({ id: `sq-${i}`, kind: "squad", displayName: `Squad ${i}` }),
  );

  it("detects franchise paired division", () => {
    expect(isFranchisePairedDivision(players, [...individuals, ...pairs])).toBe(true);
    expect(isFranchisePairedDivision(players, individuals)).toBe(false);
  });

  it("counts players from registrations, not inflated participant rows", () => {
    expect(countApprovedPlayers(players)).toBe(53);
    expect(countCompetitorParticipants([...individuals, ...pairs, ...squads])).toEqual({
      pairs: 28,
      franchiseTeams: 4,
    });
  });

  it("filters draw competitors to pairs and franchise teams", () => {
    const competitors = competitorsForDraw([...individuals, ...pairs, ...squads]);
    expect(competitors).toHaveLength(32);
    expect(competitors.every((p) => p.kind === "pair" || p.kind === "squad")).toBe(true);
  });

  it("filters check-in roster to individual players after pairing", () => {
    const roster = playersForCheckIn([...individuals, ...pairs, ...squads]);
    expect(roster).toHaveLength(53);
    expect(roster.every((p) => p.kind === "individual")).toBe(true);
  });
});
