/**
 * Wheel deck composition.
 *
 * Card identity used to be drawn independently for each slot, so six slots could
 * land four of one card and none of another — the organizer asked for a mix and
 * got whatever chance produced. The deck now carries exact counts.
 */

import { describe, expect, it } from "vitest";

import { buildWheelSlots } from "@/features/squads/components/draft-ceremony/power-slots";
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
