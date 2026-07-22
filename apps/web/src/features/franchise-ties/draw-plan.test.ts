/**
 * The numbers the organizer sees before generating a draw.
 *
 * Matches per fixture is set by the LARGEST team so every pair gets on court.
 * It used to be the smallest, which silently stranded a bigger team's extra
 * pairs — those players were drafted and never played.
 */

import { describe, expect, it } from "vitest";

/** Mirrors the preview panel's arithmetic (and the backend default). */
function plan(pairCounts: number[]) {
  const teams = pairCounts.length;
  const perFixture = Math.max(...pairCounts);
  const fixtures = (teams * (teams - 1)) / 2;
  return {
    perFixture,
    fixtures,
    totalMatches: fixtures * perFixture,
    doubleUp: pairCounts.filter((p) => p < perFixture).length,
    drawsPossible: perFixture % 2 === 0,
  };
}

describe("draw plan", () => {
  it("sizes a fixture to the largest team so the extra pair plays", () => {
    const p = plan([8, 7, 7, 7]);
    expect(p.perFixture).toBe(8);
    expect(p.fixtures).toBe(6);
    expect(p.totalMatches).toBe(48);
  });

  it("flags the teams that will field a pair twice", () => {
    expect(plan([8, 7, 7, 7]).doubleUp).toBe(3);
    expect(plan([7, 7, 7, 7]).doubleUp).toBe(0);
  });

  it("warns that an even fixture size allows a drawn fixture", () => {
    expect(plan([8, 7]).drawsPossible).toBe(true);
    expect(plan([7, 7]).drawsPossible).toBe(false);
  });

  it("counts fixtures for a round robin", () => {
    expect(plan([1, 1, 1]).fixtures).toBe(3);
    expect(plan([1, 1, 1, 1, 1, 1]).fixtures).toBe(15);
  });
});
