/**
 * Wheel deck composition.
 *
 * Card identity used to be drawn independently for each slot, so six slots could
 * land four of one card and none of another — the organizer asked for a mix and
 * got whatever chance produced. The deck now carries exact counts.
 */

import { describe, expect, it } from "vitest";

import {
  buildDeckForWheel,
  buildWheelSlots,
  wheelDeckCapacity,
} from "@/features/squads/components/draft-ceremony/power-slots";
import type { PowerCardId } from "@/features/squads/components/draft-ceremony/power-cards/types";
import type { UnassignedRegistrationView } from "@/features/squads/types";

function pool(n: number): UnassignedRegistrationView[] {
  return Array.from({ length: n }, (_, i) => ({
    registrationId: `r${i}`,
    displayName: `Player ${i}`,
    skillLevel: null,
    divisionId: "d1",
    divisionName: "D1",
    skillWeight: 2,
    status: "approved",
  }));
}

function cardCounts(slots: ReturnType<typeof buildWheelSlots>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const slot of slots) {
    if (slot.type !== "power") continue;
    out[slot.power] = (out[slot.power] ?? 0) + 1;
  }
  return out;
}

describe("buildWheelSlots — deck composition", () => {
  it("places exactly the requested number of each card", () => {
    const deck = ["choose", "choose", "swap", "swap", "protection", "protection"];
    // Repeated because the placement shuffles — a single pass could pass by luck.
    for (let run = 0; run < 25; run++) {
      const counts = cardCounts(buildWheelSlots(pool(24), deck));
      expect(counts).toEqual({ choose: 2, swap: 2, protection: 2 });
    }
  });

  it("honours an uneven mix", () => {
    const deck = ["swap", "protection", "protection", "protection"];
    const counts = cardCounts(buildWheelSlots(pool(20), deck));
    expect(counts).toEqual({ swap: 1, protection: 3 });
  });

  it("omits a card entirely when its count is zero", () => {
    // A count of 0 contributes nothing to the deck, so the card cannot appear.
    const counts = cardCounts(buildWheelSlots(pool(20), ["swap", "swap"]));
    expect(counts).toEqual({ swap: 2 });
    expect(counts.choose).toBeUndefined();
  });

  it("keeps every player on the wheel", () => {
    const slots = buildWheelSlots(pool(15), ["swap", "choose"]);
    expect(slots.filter((s) => s.type === "player")).toHaveLength(15);
    expect(slots).toHaveLength(17);
  });

  it("never places two cards next to each other", () => {
    for (let run = 0; run < 25; run++) {
      const slots = buildWheelSlots(pool(20), ["swap", "choose", "protection", "respin"]);
      for (let i = 1; i < slots.length; i++) {
        expect(slots[i]!.type === "power" && slots[i - 1]!.type === "power").toBe(false);
      }
    }
  });

  it("returns players only when no card is enabled", () => {
    const slots = buildWheelSlots(pool(10), []);
    expect(slots.every((s) => s.type === "player")).toBe(true);
  });

  it("never places more cards than players", () => {
    const slots = buildWheelSlots(
      pool(3),
      Array.from({ length: 10 }, () => "swap"),
    );
    expect(slots.filter((s) => s.type === "power").length).toBeLessThanOrEqual(3);
  });

  it("varies card positions between builds", () => {
    // Shuffled placement, so the same deck should not always land identically.
    const seen = new Set<string>();
    for (let run = 0; run < 30; run++) {
      const slots = buildWheelSlots(pool(20), ["swap", "choose", "protection"]);
      seen.add(slots.map((s) => (s.type === "power" ? s.power : "-")).join(""));
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("buildDeckForWheel — per-wheel counts", () => {
  const ids = ["respin", "protection", "swap"] as PowerCardId[];

  it("repeats each card as many times as that wheel asked for", () => {
    const deck = buildDeckForWheel(ids, { respin: 2, protection: 1, swap: 0 }, 1);
    expect(deck.filter((d) => d === "respin")).toHaveLength(2);
    expect(deck.filter((d) => d === "protection")).toHaveLength(1);
    expect(deck.filter((d) => d === "swap")).toHaveLength(0);
  });

  it("lets two wheels hold different numbers of the same card", () => {
    // The whole point: advanced is thin, intermediate is crowded.
    const advanced = buildDeckForWheel(ids, { respin: 1, protection: 1, swap: 1 }, 1);
    const intermediate = buildDeckForWheel(ids, { respin: 2, protection: 2, swap: 2 }, 1);
    expect(advanced).toHaveLength(3);
    expect(intermediate).toHaveLength(6);
  });

  it("falls back for a tier the organizer never opened", () => {
    expect(buildDeckForWheel(ids, undefined, 1)).toHaveLength(3);
  });

  it("treats a negative count as off rather than throwing", () => {
    expect(buildDeckForWheel(ids, { respin: -3 }, 1)).toHaveLength(2);
  });
});

describe("wheelDeckCapacity", () => {
  it("reports the shortfall when a wheel is too thin for the deck", () => {
    // 6 cards configured, only 4 players left on the advanced wheel.
    expect(wheelDeckCapacity(6, 4)).toEqual({ requested: 6, fits: 4, dropped: 2 });
  });

  it("reports no shortfall when everything fits", () => {
    expect(wheelDeckCapacity(4, 30)).toEqual({ requested: 4, fits: 4, dropped: 0 });
  });

  it("matches what buildWheelSlots actually places", () => {
    const deck = Array.from({ length: 6 }, () => "respin" as PowerCardId);
    const placed = buildWheelSlots(pool(4), deck).filter((s) => s.type === "power").length;
    expect(placed).toBe(wheelDeckCapacity(6, 4).fits);
  });
});
