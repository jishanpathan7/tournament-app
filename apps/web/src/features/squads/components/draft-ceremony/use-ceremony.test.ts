import { describe, expect, it } from "vitest";

import type { SquadView } from "@/features/squads/types";
import { pickTargetSquad } from "./use-ceremony";

function makeSquad(
  id: string,
  memberCount: number,
  totalSkillWeight: number,
  sortOrder = 0,
): SquadView {
  return {
    id,
    name: id,
    sortOrder,
    captainRegistrationId: null,
    memberCount,
    totalSkillWeight,
    members: [],
  };
}

describe("pickTargetSquad", () => {
  it("returns undefined when squads is empty", () => {
    expect(pickTargetSquad([], new Map())).toBeUndefined();
  });

  it("picks the squad with fewest players", () => {
    const squads = [makeSquad("a", 3, 6, 0), makeSquad("b", 1, 2, 1), makeSquad("c", 2, 4, 2)];
    const state = new Map([
      ["a", { playerCount: 3, skillWeight: 6 }],
      ["b", { playerCount: 1, skillWeight: 2 }],
      ["c", { playerCount: 2, skillWeight: 4 }],
    ]);
    expect(pickTargetSquad(squads, state)?.id).toBe("b");
  });

  it("breaks size ties by lowest skill weight", () => {
    const squads = [makeSquad("a", 2, 8, 0), makeSquad("b", 2, 4, 1), makeSquad("c", 2, 6, 2)];
    const state = new Map([
      ["a", { playerCount: 2, skillWeight: 8 }],
      ["b", { playerCount: 2, skillWeight: 4 }],
      ["c", { playerCount: 2, skillWeight: 6 }],
    ]);
    expect(pickTargetSquad(squads, state)?.id).toBe("b");
  });

  it("breaks weight ties by sort order", () => {
    const squads = [makeSquad("a", 2, 4, 2), makeSquad("b", 2, 4, 0), makeSquad("c", 2, 4, 1)];
    const state = new Map([
      ["a", { playerCount: 2, skillWeight: 4 }],
      ["b", { playerCount: 2, skillWeight: 4 }],
      ["c", { playerCount: 2, skillWeight: 4 }],
    ]);
    expect(pickTargetSquad(squads, state)?.id).toBe("b");
  });

  it("falls back to squad data when state map has no entry for a squad", () => {
    const squads = [makeSquad("a", 3, 6, 0), makeSquad("b", 1, 2, 1)];
    // Empty state — should fall back to squad.memberCount / squad.totalSkillWeight
    expect(pickTargetSquad(squads, new Map())?.id).toBe("b");
  });

  it("produces balanced distribution across simulated picks", () => {
    // 4 teams, 12 players with varying skill weights — verify final counts equal
    const squads = [
      makeSquad("t1", 1, 3, 0), // captain: advanced
      makeSquad("t2", 1, 2, 1), // captain: intermediate
      makeSquad("t3", 1, 2, 2),
      makeSquad("t4", 1, 1, 3), // captain: beginner
    ];
    const state = new Map([
      ["t1", { playerCount: 1, skillWeight: 3 }],
      ["t2", { playerCount: 1, skillWeight: 2 }],
      ["t3", { playerCount: 1, skillWeight: 2 }],
      ["t4", { playerCount: 1, skillWeight: 1 }],
    ]);

    // Simulate 12 picks: alternating advanced(3)/intermediate(2)/beginner(1)
    const weights = [3, 2, 1, 3, 2, 1, 3, 2, 1, 3, 2, 1];
    const picks: Record<string, number> = { t1: 0, t2: 0, t3: 0, t4: 0 };

    for (const w of weights) {
      const target = pickTargetSquad(squads, state);
      expect(target).toBeDefined();
      const id = target!.id;
      picks[id]++;
      const prev = state.get(id)!;
      state.set(id, { playerCount: prev.playerCount + 1, skillWeight: prev.skillWeight + w });
    }

    // Each team should receive exactly 3 players
    expect(Object.values(picks).every((c) => c === 3)).toBe(true);
  });
});
