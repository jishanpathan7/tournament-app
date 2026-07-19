/**
 * Engine + card behavior — driven with NO React in the dependency graph. Proves
 * the engine is generic (reaches cards only via the registry) and fully testable
 * as plain data. Importing the barrel self-registers the four real cards.
 */

import { describe, expect, it, vi } from "vitest";

import "./index"; // self-registers the four cards
import { canPlay, playCard, previewCard, reduceTeamCards } from "./engine";
import type { CardContext, MutationPort } from "./types";
import type { SquadMemberView, SquadView } from "@/features/squads/types";

function member(id: string, name: string, weight: number): SquadMemberView {
  return {
    registrationId: id,
    displayName: name,
    skillLevel: null,
    divisionId: "d1",
    divisionName: "D1",
    skillWeight: weight,
  };
}

function squad(id: string, name: string, members: SquadMemberView[]): SquadView {
  return {
    id,
    name,
    sortOrder: 0,
    captainRegistrationId: members[0]?.registrationId ?? null, // first = captain
    memberCount: members.length,
    totalSkillWeight: members.reduce((s, m) => s + m.skillWeight, 0),
    members,
  };
}

function fakePort() {
  const calls: string[] = [];
  const port: MutationPort = {
    assign: vi.fn(async (squadId: string, rid: string) => {
      calls.push(`assign:${squadId}:${rid}`);
    }),
    remove: vi.fn(async (squadId: string, rid: string) => {
      calls.push(`remove:${squadId}:${rid}`);
    }),
  };
  return { port, calls };
}

// Team A: captain a-cap + player a1(5). Team B: captain b-cap + player b1(6).
function board(): SquadView[] {
  return [
    squad("A", "Team A", [member("a-cap", "Cap A", 10), member("a1", "Aman", 5)]),
    squad("B", "Team B", [member("b-cap", "Cap B", 10), member("b1", "Rahul", 6)]),
  ];
}

function ctx(over: Partial<CardContext>): CardContext {
  const { port } = fakePort();
  return {
    cardId: "meme",
    squadId: "A",
    squads: board(),
    teamCards: {},
    port,
    ...over,
  };
}

describe("reduceTeamCards", () => {
  it("awards and consumes without mutating the input", () => {
    const start = {};
    const awarded = reduceTeamCards(start, [
      { type: "CardAwarded", squadId: "A", squadName: "Team A", cardId: "meme" },
    ]);
    expect(awarded).toEqual({ A: ["meme"] });
    expect(start).toEqual({}); // immutable

    const consumed = reduceTeamCards(awarded, [
      { type: "CardConsumed", squadId: "A", cardId: "meme" },
    ]);
    expect(consumed).toEqual({ A: [] });
  });
});

describe("Meme Drop (instant)", () => {
  it("is always playable and emits consume + played-with-meme", async () => {
    const c = ctx({ cardId: "meme", teamCards: { A: ["meme"] } });
    expect(canPlay("meme", c)).toBe(true);
    const { events } = await playCard("meme", c);
    expect(events.find((e) => e.type === "CardConsumed")).toMatchObject({ squadId: "A" });
    const played = events.find((e) => e.type === "CardPlayed");
    expect(played).toBeTruthy();
    expect(played && "meme" in played && played.meme).toBeTruthy();
  });
});

describe("First Ball Trial (self)", () => {
  it("is playable only when the team holds it", () => {
    expect(canPlay("respin", ctx({ cardId: "respin", squadId: "A", teamCards: {} }))).toBe(false);
    expect(
      canPlay("respin", ctx({ cardId: "respin", squadId: "A", teamCards: { A: ["respin"] } })),
    ).toBe(true);
  });
});

describe("Dabur Immunity (passive)", () => {
  it("is never directly playable", () => {
    expect(
      canPlay("protection", ctx({ cardId: "protection", teamCards: { A: ["protection"] } })),
    ).toBe(false);
  });
});

describe("Jo Tera Hai Wo Mera (targeted)", () => {
  it("previews the closest-skill pair", () => {
    const c = ctx({ cardId: "swap", squadId: "A", targetSquadId: "B", teamCards: { A: ["swap"] } });
    const preview = previewCard("swap", c);
    expect(preview?.ok).toBe(true);
    expect(preview?.swap).toMatchObject({ fromSquad: "Team A", toSquad: "Team B" });
    // a1(5) vs b1(6) is the only non-captain pair.
    expect(preview?.summary).toContain("Aman");
    expect(preview?.summary).toContain("Rahul");
  });

  it("executes a 1-for-1 swap via the port (remove,remove,assign,assign) and consumes the card", async () => {
    const { port, calls } = fakePort();
    const c: CardContext = {
      cardId: "swap",
      squadId: "A",
      targetSquadId: "B",
      squads: board(),
      teamCards: { A: ["swap"] },
      port,
    };
    const { events } = await playCard("swap", c);
    expect(calls).toEqual(["remove:A:a1", "remove:B:b1", "assign:B:a1", "assign:A:b1"]);
    expect(events.find((e) => e.type === "SwapCompleted")).toMatchObject({
      aName: "Aman",
      bName: "Rahul",
    });
    expect(events.find((e) => e.type === "CardConsumed")).toMatchObject({ cardId: "swap" });
  });

  it("is blocked by the target's Dabur Immunity — both cards consumed, no port calls", async () => {
    const { port, calls } = fakePort();
    const c: CardContext = {
      cardId: "swap",
      squadId: "A",
      targetSquadId: "B",
      squads: board(),
      teamCards: { A: ["swap"], B: ["protection"] },
      port,
    };
    const { events } = await playCard("swap", c);
    expect(calls).toEqual([]); // nothing moved
    expect(events.find((e) => e.type === "SwapBlocked")).toBeTruthy();
    expect(events.find((e) => e.type === "ImmunityTriggered")).toBeTruthy();
    const consumed = events.filter((e) => e.type === "CardConsumed").map((e) => e.cardId);
    expect(consumed).toEqual(expect.arrayContaining(["swap", "protection"]));
  });
});
