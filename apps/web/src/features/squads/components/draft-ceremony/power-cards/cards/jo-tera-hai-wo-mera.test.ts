/**
 * Jo Tera Hai Wo Mera — the captain chooses both players, and the two must
 * share a skill level. Before this, the card auto-picked the closest-skill pair
 * and would trade advanced for intermediate when nothing nearer existed.
 */

import { describe, expect, it, vi } from "vitest";

import {
  joTeraHaiWoMera,
  legalSwaps,
  sameSkill,
} from "@/features/squads/components/draft-ceremony/power-cards/cards/jo-tera-hai-wo-mera";
import type { CardContext } from "@/features/squads/components/draft-ceremony/power-cards/types";
import type { SquadMemberView, SquadView } from "@/features/squads/types";

function member(id: string, skillLevel: string | null): SquadMemberView {
  const weight = skillLevel === "advanced" ? 3 : skillLevel === "intermediate" ? 2 : 1;
  return {
    registrationId: id,
    displayName: id,
    skillLevel,
    divisionId: "d1",
    divisionName: "D1",
    skillWeight: weight,
  } as SquadMemberView;
}

function squad(id: string, members: SquadMemberView[], captainId?: string): SquadView {
  return {
    id,
    name: id,
    members,
    memberCount: members.length,
    captainRegistrationId: captainId ?? null,
  } as SquadView;
}

const port = { swap: vi.fn(async () => {}) };

function ctx(from: SquadView, to: SquadView, chosen?: CardContext["chosenSwap"]): CardContext {
  return {
    cardId: "swap",
    squadId: from.id,
    targetSquadId: to.id,
    chosenSwap: chosen,
    squads: [from, to],
    teamCards: { [from.id]: ["swap"] },
    port,
  };
}

describe("skill matching", () => {
  it("pairs equal levels only", () => {
    expect(sameSkill(member("a", "advanced"), member("b", "advanced"))).toBe(true);
    expect(sameSkill(member("a", "advanced"), member("b", "intermediate"))).toBe(false);
  });

  it("treats players with no recorded level as their own group", () => {
    // Not a wildcard — otherwise "unspecified" becomes a back door to the
    // advanced-for-beginner trade the rule exists to prevent.
    expect(sameSkill(member("a", null), member("b", null))).toBe(true);
    expect(sameSkill(member("a", null), member("b", "advanced"))).toBe(false);
  });
});

describe("legalSwaps", () => {
  it("offers every same-skill combination across the two teams", () => {
    const from = squad("A", [member("a1", "advanced"), member("a2", "beginner")]);
    const to = squad("B", [member("b1", "advanced"), member("b2", "advanced")]);

    const pairs = legalSwaps(from, to);
    expect(pairs).toHaveLength(2);
    expect(pairs.every((p) => p.a.registrationId === "a1")).toBe(true);
  });

  it("never offers a captain, on either side", () => {
    const from = squad("A", [member("a1", "advanced")], "a1");
    const to = squad("B", [member("b1", "advanced")]);
    expect(legalSwaps(from, to)).toHaveLength(0);

    const from2 = squad("A", [member("a1", "advanced")]);
    const to2 = squad("B", [member("b1", "advanced")], "b1");
    expect(legalSwaps(from2, to2)).toHaveLength(0);
  });

  it("finds nothing when the levels do not line up", () => {
    const from = squad("A", [member("a1", "advanced")]);
    const to = squad("B", [member("b1", "beginner")]);
    expect(legalSwaps(from, to)).toHaveLength(0);
  });
});

describe("playing the card", () => {
  it("swaps exactly the pair the captain chose", async () => {
    port.swap.mockClear();
    const from = squad("A", [member("a1", "advanced"), member("a2", "advanced")]);
    const to = squad("B", [member("b1", "advanced"), member("b2", "advanced")]);

    await joTeraHaiWoMera.execute(
      ctx(from, to, { fromRegistrationId: "a2", toRegistrationId: "b2" }),
    );

    expect(port.swap).toHaveBeenCalledWith(
      { squadId: "A", registrationId: "a2" },
      { squadId: "B", registrationId: "b2" },
    );
  });

  it("refuses a mismatched choice rather than quietly correcting it", async () => {
    // A captain must never be told a swap happened that isn't the one they picked.
    port.swap.mockClear();
    const from = squad("A", [member("a1", "advanced"), member("a2", "beginner")]);
    const to = squad("B", [member("b1", "advanced")]);

    const result = await joTeraHaiWoMera.execute(
      ctx(from, to, { fromRegistrationId: "a2", toRegistrationId: "b1" }),
    );

    expect(port.swap).not.toHaveBeenCalled();
    expect(result.events.map((e) => e.type)).toEqual(["SwapBlocked"]);
  });

  it("keeps the card when no same-skill pair exists", async () => {
    port.swap.mockClear();
    const from = squad("A", [member("a1", "advanced")]);
    const to = squad("B", [member("b1", "beginner")]);

    const result = await joTeraHaiWoMera.execute(ctx(from, to));

    expect(port.swap).not.toHaveBeenCalled();
    // No CardConsumed — the captain can go after a different team.
    expect(result.events.some((e) => e.type === "CardConsumed")).toBe(false);
  });

  it("is still blocked by Dabur Immunity before any choice matters", async () => {
    port.swap.mockClear();
    const from = squad("A", [member("a1", "advanced")]);
    const to = squad("B", [member("b1", "advanced")]);
    const c = ctx(from, to, { fromRegistrationId: "a1", toRegistrationId: "b1" });
    c.teamCards = { A: ["swap"], B: ["protection"] };

    const result = await joTeraHaiWoMera.execute(c);

    expect(port.swap).not.toHaveBeenCalled();
    expect(result.events.map((e) => e.type)).toContain("SwapBlocked");
    expect(result.events.map((e) => e.type)).toContain("ImmunityTriggered");
  });

  it("previews a suggestion when the captain has not chosen yet", () => {
    const from = squad("A", [member("a1", "advanced")]);
    const to = squad("B", [member("b1", "advanced")]);
    const preview = joTeraHaiWoMera.preview!(ctx(from, to));
    expect(preview.ok).toBe(true);
  });
});
