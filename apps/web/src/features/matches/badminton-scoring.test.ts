import { describe, expect, it } from "vitest";

import {
  classifyGame,
  decidingGameIndex,
  formatMatchRules,
  gameStatusIndicator,
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
    expect(classifyGame(30, 29).status).toBe("complete"); // golden point at cap, from 29-all
    expect(classifyGame(30, 28).status).toBe("complete"); // win by 2 from 29-28
    expect(classifyGame(30, 27).status).toBe("invalid"); // unreachable
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
    expect(resolveTiedGame(29, "b")).toEqual({ a: 29, b: 30 });
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

// ---- SIBL rules: pointsPerSet=15, winBy=2, maxPoints=21 ----

const SIBL = rulesFromSportConfig({ bestOf: 3, pointsPerSet: 15, winBy: 2, maxPoints: 21 });

describe("classifyGame — SIBL rules", () => {
  it.each([
    [15, 0],
    [15, 8],
    [15, 13],
    [16, 14],
    [17, 15],
    [18, 16],
    [19, 17],
    [20, 18],
    [21, 20], // golden point at the cap, from 20-all
    [21, 19], // cap reached by winning by 2 from 20-19
  ])("%i-%i is complete", (a, b) => {
    expect(classifyGame(a, b, SIBL).status).toBe("complete");
    expect(classifyGame(b, a, SIBL).status).toBe("complete"); // mirror
  });

  it.each([
    [21, 18, "unreachable — the game ends on a 2-point lead first"],
    [22, 20, "exceeds cap"],
  ])("%i-%i is invalid (%s)", (a, b) => {
    expect(classifyGame(a, b, SIBL).status).toBe("invalid");
    expect(classifyGame(b, a, SIBL).status).toBe("invalid");
  });

  it("14-14 is tied (in_progress)", () => {
    expect(classifyGame(14, 14, SIBL)).toEqual({ status: "tied", score: 14 });
  });

  it("20-20 is tied (in_progress)", () => {
    expect(classifyGame(20, 20, SIBL)).toEqual({ status: "tied", score: 20 });
  });

  it("15-14 is in_progress (reached target but not win-by-2 margin yet)", () => {
    const result = classifyGame(15, 14, SIBL);
    expect(result.status).toBe("in_progress");
  });
});

describe("resolveTiedGame — SIBL rules", () => {
  it("resolves 14-14 to 16-14 (deuce)", () => {
    expect(resolveTiedGame(14, "a", SIBL)).toEqual({ a: 16, b: 14 });
    expect(resolveTiedGame(14, "b", SIBL)).toEqual({ a: 14, b: 16 });
  });

  it("resolves 20-20 to 21-20 (golden point, never 21-19)", () => {
    const result = resolveTiedGame(20, "a", SIBL)!;
    expect(result).toEqual({ a: 21, b: 20 });
    expect(classifyGame(result.a, result.b, SIBL).status).toBe("complete");
  });

  it("all SIBL tied resolutions produce valid scores", () => {
    for (const tied of [14, 15, 16, 17, 18, 19, 20]) {
      for (const winner of ["a", "b"] as const) {
        const resolved = resolveTiedGame(tied, winner, SIBL)!;
        expect(classifyGame(resolved.a, resolved.b, SIBL).status).toBe("complete");
      }
    }
  });
});

describe("gameStatusIndicator — SIBL rules", () => {
  it("returns null below deuce threshold", () => {
    expect(gameStatusIndicator(13, 13, SIBL)).toBeNull();
  });

  it("returns 'deuce' at 14-14 through 19-19", () => {
    for (const s of [14, 15, 16, 17, 18, 19]) {
      expect(gameStatusIndicator(s, s, SIBL)).toBe("deuce");
    }
  });

  it("returns 'next_point_wins' at 20-20", () => {
    expect(gameStatusIndicator(20, 20, SIBL)).toBe("next_point_wins");
  });

  it("returns null when scores are not tied", () => {
    expect(gameStatusIndicator(15, 14, SIBL)).toBeNull();
    expect(gameStatusIndicator(20, 19, SIBL)).toBeNull();
  });
});

describe("formatMatchRules", () => {
  it("produces the correct SIBL format string", () => {
    expect(formatMatchRules(SIBL)).toBe("Best of 3 · First to 15 · Win by 2 · Cap 21");
  });

  it("produces the correct default format string", () => {
    expect(formatMatchRules()).toBe("Best of 3 · First to 21 · Win by 2 · Cap 30");
  });
});

describe("SIBL match flow", () => {
  it("2-0 match is decided", () => {
    const games = [
      { a: 16, b: 14 },
      { a: 15, b: 8 },
    ];
    expect(matchDecided(games, SIBL)).toBe(true);
  });

  it("2-1 match is decided", () => {
    const games = [
      { a: 16, b: 14 },
      { a: 12, b: 15 },
      { a: 21, b: 20 },
    ];
    expect(matchDecided(games, SIBL)).toBe(true);
  });

  it("1-1 is NOT decided — third set needed", () => {
    const games = [
      { a: 16, b: 14 },
      { a: 12, b: 15 },
    ];
    expect(matchDecided(games, SIBL)).toBe(false);
    expect(decidingGameIndex(2, games, SIBL)).toBe(true);
  });
});
