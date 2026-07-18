import { describe, expect, it } from "vitest";

import type { SquadView } from "@/features/squads/types";
import { computeDraftOrder } from "./use-ceremony";

function makeSquad(id: string, totalSkillWeight: number, sortOrder = 0): SquadView {
  return {
    id,
    name: id,
    sortOrder,
    captainRegistrationId: null,
    memberCount: 1,
    totalSkillWeight,
    members: [],
  };
}

describe("computeDraftOrder", () => {
  it("returns empty array when no players", () => {
    const squads = [makeSquad("a", 3, 0), makeSquad("b", 2, 1)];
    expect(computeDraftOrder(squads, 0, 0)).toEqual([]);
  });

  it("returns empty array when no squads", () => {
    expect(computeDraftOrder([], 4, 8)).toEqual([]);
  });

  it("all picks go to single team", () => {
    const squads = [makeSquad("a", 3, 0)];
    const order = computeDraftOrder(squads, 3, 6);
    expect(order).toEqual(["a", "a", "a"]);
  });

  it("team with lower captain skill picks first", () => {
    // T1 captain weight=3, T2 captain weight=1 → T2 picks first
    const squads = [makeSquad("t1", 3, 0), makeSquad("t2", 1, 1)];
    const order = computeDraftOrder(squads, 4, 8);
    expect(order[0]).toBe("t2");
  });

  it("guarantees size balance: ≤1 difference across all teams", () => {
    // 13 players, 4 teams → sizes should be [4,3,3,3] or similar ±1
    const squads = [
      makeSquad("t1", 3, 0),
      makeSquad("t2", 2, 1),
      makeSquad("t3", 2, 2),
      makeSquad("t4", 1, 3),
    ];
    const order = computeDraftOrder(squads, 13, 26);
    const counts: Record<string, number> = { t1: 0, t2: 0, t3: 0, t4: 0 };
    for (const id of order) counts[id] = (counts[id] ?? 0) + 1;
    const vals = Object.values(counts);
    expect(Math.max(...vals) - Math.min(...vals)).toBeLessThanOrEqual(1);
    expect(order.length).toBe(13);
  });

  it("guarantees size balance with even split", () => {
    const squads = [
      makeSquad("t1", 3, 0),
      makeSquad("t2", 2, 1),
      makeSquad("t3", 2, 2),
      makeSquad("t4", 1, 3),
    ];
    const order = computeDraftOrder(squads, 12, 24);
    const counts: Record<string, number> = { t1: 0, t2: 0, t3: 0, t4: 0 };
    for (const id of order) counts[id] = (counts[id] ?? 0) + 1;
    expect(Object.values(counts).every((c) => c === 3)).toBe(true);
  });

  it("tiebreaks on sort order when captain weights are equal", () => {
    // All equal weight → should follow sort order round-robin
    const squads = [makeSquad("t1", 2, 0), makeSquad("t2", 2, 1), makeSquad("t3", 2, 2)];
    const order = computeDraftOrder(squads, 3, 6);
    // First 3 picks: each team gets exactly 1 in sort-order sequence
    expect(order).toEqual(["t1", "t2", "t3"]);
  });

  it("weak-captain team picks first to compensate skill deficit", () => {
    // t1: strong captain (weight 5, sortOrder 0), t2: weak captain (weight 1, sortOrder 1)
    // expectedGain = 12/6 = 2 per pick
    // Pick 1: draft picks equal, t2 weight(1) < t1 weight(5) → t2 picks
    // Pick 2: t1 has 0 draft picks, t2 has 1 → t1 picks (size balance)
    // Pick 3: t1 weight=5+2=7, t2 weight=1+2=3 → t2 picks
    const squads = [makeSquad("t1", 5, 0), makeSquad("t2", 1, 1)];
    const order = computeDraftOrder(squads, 6, 12);
    expect(order[0]).toBe("t2");
    expect(order[1]).toBe("t1"); // size balance kicks in
    expect(order[2]).toBe("t2"); // t2 weight(3) < t1 weight(7)
  });

  it("handles fewer players than teams", () => {
    // 3 players, 4 teams → one team gets 0 picks
    const squads = [
      makeSquad("t1", 2, 0),
      makeSquad("t2", 2, 1),
      makeSquad("t3", 2, 2),
      makeSquad("t4", 2, 3),
    ];
    const order = computeDraftOrder(squads, 3, 6);
    expect(order.length).toBe(3);
    const counts: Record<string, number> = { t1: 0, t2: 0, t3: 0, t4: 0 };
    for (const id of order) counts[id] = (counts[id] ?? 0) + 1;
    const vals = Object.values(counts);
    expect(Math.max(...vals) - Math.min(...vals)).toBeLessThanOrEqual(1);
  });

  it("all-zero pool weight still produces a valid size-balanced order", () => {
    // expectedGain = 0 → degenerates to size-only balance
    const squads = [makeSquad("t1", 0, 0), makeSquad("t2", 0, 1)];
    const order = computeDraftOrder(squads, 4, 0);
    const counts: Record<string, number> = { t1: 0, t2: 0 };
    for (const id of order) counts[id] = (counts[id] ?? 0) + 1;
    expect(counts.t1).toBe(2);
    expect(counts.t2).toBe(2);
  });
});
