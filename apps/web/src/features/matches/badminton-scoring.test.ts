import { describe, expect, it } from "vitest";

import {
  classifyGame,
  decidingGameIndex,
  gamesWonBySide,
  matchDecided,
  resolveTiedGame,
  rulesFromSportConfig,
} from "@/features/matches/badminton-scoring";

describe("classifyGame", () => {
  it("requires someone to reach 21", () => {
    expect(classifyGame(20, 18).status).toBe("in_progress");
    expect(classifyGame(21, 19).status).toBe("complete");
  });

  it("rejects 21-20 without win-by-2", () => {
    const r = classifyGame(21, 20);
    expect(r.status).toBe("in_progress");
    if (r.status === "in_progress") expect(r.message).toContain("Win by 2");
  });

  it("accepts deuce finishes", () => {
    expect(classifyGame(22, 20).status).toBe("complete");
    expect(classifyGame(30, 28).status).toBe("complete");
  });

  it("flags equal scores as tied", () => {
    expect(classifyGame(20, 20)).toEqual({ status: "tied", score: 20 });
    expect(classifyGame(15, 15)).toEqual({ status: "tied", score: 15 });
  });
});

describe("resolveTiedGame", () => {
  it("awards 21 when tied below target", () => {
    expect(resolveTiedGame(15, "a")).toEqual({ a: 21, b: 15 });
    expect(resolveTiedGame(15, "b")).toEqual({ a: 15, b: 21 });
  });

  it("applies win-by-2 at deuce", () => {
    expect(resolveTiedGame(20, "a")).toEqual({ a: 22, b: 20 });
    expect(resolveTiedGame(29, "b")).toEqual({ a: 28, b: 30 });
  });
});

describe("match flow", () => {
  it("needs a third game at 1-1 in best of 3", () => {
    const games = [
      { a: 21, b: 15 },
      { a: 18, b: 21 },
    ];
    expect(matchDecided(games)).toBe(false);
    expect(gamesWonBySide(games, "a")).toBe(1);
    expect(decidingGameIndex(2, games)).toBe(true);
  });

  it("decides at 2-0 in best of 3", () => {
    const games = [
      { a: 21, b: 10 },
      { a: 21, b: 12 },
    ];
    expect(matchDecided(games)).toBe(true);
    expect(decidingGameIndex(2, games)).toBe(false);
  });

  it("decides after one game in best of 1", () => {
    const rules = rulesFromSportConfig({ bestOf: 1 });
    const games = [{ a: 21, b: 15 }];
    expect(matchDecided(games, rules)).toBe(true);
  });
});

describe("resolve produces valid games", () => {
  it("resolved scores pass classifyGame", () => {
    for (const tied of [10, 15, 20, 29]) {
      for (const winner of ["a", "b"] as const) {
        const resolved = resolveTiedGame(tied, winner)!;
        expect(classifyGame(resolved.a, resolved.b).status).toBe("complete");
      }
    }
  });
});
