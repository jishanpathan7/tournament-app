/**
 * Engine + card behavior — driven with NO React in the dependency graph. Proves
 * the engine is generic (reaches cards only via the registry) and fully testable
 * as plain data. Importing the barrel self-registers the four real cards.
 */

import { describe, expect, it, vi } from "vitest";

import "./index"; // self-registers every card
import { canPlay, isUndoable, playCard, previewCard, reduceTeamCards, undoCard } from "./engine";
import { allCards, getCard } from "./registry";
import { isChoiceCard, isRerollCard } from "./index";
import type { CardContext, MutationPort, SwapSide } from "./types";
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
    swap: vi.fn(async (a: SwapSide, b: SwapSide) => {
      calls.push(`swap:${a.squadId}:${a.registrationId}<->${b.squadId}:${b.registrationId}`);
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
    cardId: "respin",
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
      { type: "CardAwarded", squadId: "A", squadName: "Team A", cardId: "respin" },
    ]);
    expect(awarded).toEqual({ A: ["respin"] });
    expect(start).toEqual({}); // immutable

    const consumed = reduceTeamCards(awarded, [
      { type: "CardConsumed", squadId: "A", cardId: "respin" },
    ]);
    expect(consumed).toEqual({ A: [] });
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

describe("Meri Marzi (self, needs a choice)", () => {
  it("is playable only when the team holds it, and declares its picker", () => {
    expect(canPlay("choose", ctx({ cardId: "choose", squadId: "A", teamCards: {} }))).toBe(false);
    expect(
      canPlay("choose", ctx({ cardId: "choose", squadId: "A", teamCards: { A: ["choose"] } })),
    ).toBe(true);
    expect(getCard("choose").selection).toMatchObject({ from: "pool" });
  });

  it("spends the card and announces, leaving the pick to the ceremony", async () => {
    const c = ctx({ cardId: "choose", squadId: "A", teamCards: { A: ["choose"] } });
    const { events } = await playCard("choose", c);
    expect(events.map((e) => e.type)).toEqual(["CardConsumed", "CardPlayed"]);
  });
});

describe("self-card roles", () => {
  it("never offers the same card in both places", () => {
    // Regression: the re-roll slot matched every self card, so Meri Marzi showed
    // as both a picker and a re-roll — and the re-roll path spent it without
    // letting anyone choose.
    for (const card of allCards()) {
      expect(isChoiceCard(card) && isRerollCard(card)).toBe(false);
    }
  });

  it("routes each self card to exactly one of the two", () => {
    for (const card of allCards().filter((c) => c.mode === "self")) {
      expect(isChoiceCard(card) !== isRerollCard(card)).toBe(true);
    }
  });

  it("puts Meri Marzi in the picker and First Ball Trial in the re-roll", () => {
    expect(isChoiceCard(getCard("choose"))).toBe(true);
    expect(isRerollCard(getCard("choose"))).toBe(false);
    expect(isRerollCard(getCard("respin"))).toBe(true);
    expect(isChoiceCard(getCard("respin"))).toBe(false);
  });

  it("leaves non-self cards out of both", () => {
    for (const id of ["swap", "protection"]) {
      expect(isChoiceCard(getCard(id))).toBe(false);
      expect(isRerollCard(getCard(id))).toBe(false);
    }
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

  it("executes a 1-for-1 swap via a SINGLE atomic port call and consumes the card", async () => {
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
    // Exactly one atomic call — no four-step sequence that could half-fail.
    expect(calls).toEqual(["swap:A:a1<->B:b1"]);
    expect(events.find((e) => e.type === "SwapCompleted")).toMatchObject({
      aName: "Aman",
      bName: "Rahul",
    });
    expect(events.find((e) => e.type === "CardConsumed")).toMatchObject({ cardId: "swap" });
  });

  it("undoes a completed swap: players trade back and the card is returned", async () => {
    const { port, calls } = fakePort();
    const ctxBase = {
      cardId: "swap",
      squadId: "A",
      targetSquadId: "B",
      squads: board(),
      teamCards: { A: ["swap"] },
      port,
    } satisfies CardContext;

    const { events } = await playCard("swap", ctxBase);
    const done = events.find((e) => e.type === "SwapCompleted")!;

    const undone = await undoCard("swap", { ...ctxBase, event: done });

    // Second atomic call, with the sides reversed.
    expect(calls).toEqual(["swap:A:a1<->B:b1", "swap:B:a1<->A:b1"]);
    // An undone play must cost the team nothing.
    expect(undone.events.find((e) => e.type === "CardAwarded")).toMatchObject({
      squadId: "A",
      cardId: "swap",
    });
  });

  it("reports swap as undoable and passive Immunity as not", () => {
    expect(isUndoable("swap")).toBe(true);
    expect(isUndoable("protection")).toBe(false);
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
