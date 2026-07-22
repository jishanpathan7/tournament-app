import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "@/features/squads/components/draft-ceremony/ceremony-settings";
import {
  clearSession,
  loadSession,
  saveSession,
  SESSION_VERSION,
  type CeremonySession,
} from "@/features/squads/components/draft-ceremony/ceremony-session";

const TID = "t-1";

function session(over: Partial<CeremonySession> = {}): CeremonySession {
  return {
    v: SESSION_VERSION,
    phase: "main",
    draftOrder: ["A", "B"],
    totalPicks: 2,
    pickIndex: 1,
    history: [],
    teamCards: { A: ["respin"] },
    spentCards: {},
    activity: [],
    assignedIds: ["r1"],
    activeSkill: null,
    activeSkillSet: false,
    settings: DEFAULT_SETTINGS,
    ...over,
  };
}

beforeEach(() => {
  clearSession(TID);
});

describe("ceremony session persistence", () => {
  it("round-trips an in-progress ceremony", () => {
    saveSession(TID, session());
    const loaded = loadSession(TID);
    expect(loaded?.pickIndex).toBe(1);
    expect(loaded?.teamCards).toEqual({ A: ["respin"] });
    expect(loaded?.assignedIds).toEqual(["r1"]);
    expect(loaded?.draftOrder).toEqual(["A", "B"]);
  });

  it("returns null when nothing is stored", () => {
    expect(loadSession(TID)).toBeNull();
  });

  it("ignores a stale schema version", () => {
    saveSession(TID, session({ v: SESSION_VERSION + 1 }));
    expect(loadSession(TID)).toBeNull();
  });

  it("ignores ceremonies that never started", () => {
    saveSession(TID, session({ phase: "intro" }));
    expect(loadSession(TID)).toBeNull();
  });

  it("ignores a session with no draft order", () => {
    saveSession(TID, session({ draftOrder: [] }));
    expect(loadSession(TID)).toBeNull();
  });

  it("restores a finished ceremony so results survive a refresh", () => {
    saveSession(TID, session({ phase: "complete" }));
    expect(loadSession(TID)?.phase).toBe("complete");
  });

  it("tolerates a blob written before a card field existed", () => {
    // Same version, missing newer keys — restoring a partial session beats
    // dropping a live ceremony on the floor.
    const partial = session();
    delete (partial as Partial<CeremonySession>).spentCards;
    window.localStorage.setItem(`playlane:ceremony:${TID}`, JSON.stringify(partial));

    const loaded = loadSession(TID);
    expect(loaded).not.toBeNull();
    expect(loaded?.spentCards).toEqual({});
    expect(loaded?.teamCards).toEqual({ A: ["respin"] });
  });

  it("drops cards that no longer exist in the registry", () => {
    // A card retired between sessions must not crash the restore — the rest of
    // the ceremony is far more valuable than one stale card id.
    saveSession(TID, session({ teamCards: { A: ["respin", "retired-card"] } }));

    const loaded = loadSession(TID);
    expect(loaded).not.toBeNull();
    expect(loaded?.teamCards).toEqual({ A: ["respin"] });
  });

  it("fills in settings added since the session was saved", () => {
    // Regression: a session saved before a settings field existed restored it as
    // undefined and the ceremony crashed reading it on first render.
    // Clone first — `session()` hands back the shared DEFAULT_SETTINGS object,
    // and deleting from it would strip the field from the defaults themselves.
    const stale = session({ settings: { ...DEFAULT_SETTINGS } });
    delete (stale.settings as Partial<typeof stale.settings>).cardSlots;
    window.localStorage.setItem(`playlane:ceremony:${TID}`, JSON.stringify(stale));

    const loaded = loadSession(TID);
    expect(loaded?.settings.cardSlots).toEqual({});
  });

  it("lifts an old shared card deck onto every wheel", () => {
    // Card counts used to be one flat map for all wheels. A session saved then
    // would restore {respin: 2} where {advanced: {respin: 2}} is expected, and
    // every count would read as undefined halfway through a live ceremony.
    const stale = session({ settings: { ...DEFAULT_SETTINGS } });
    (stale.settings as unknown as { cardSlots: unknown }).cardSlots = { respin: 2, swap: 0 };
    window.localStorage.setItem(`playlane:ceremony:${TID}`, JSON.stringify(stale));

    const loaded = loadSession(TID);
    expect(loaded?.settings.cardSlots.advanced).toEqual({ respin: 2, swap: 0 });
    expect(loaded?.settings.cardSlots.intermediate).toEqual({ respin: 2, swap: 0 });
  });

  it("leaves an already per-wheel deck alone", () => {
    const perWheel = { advanced: { respin: 1 }, intermediate: { respin: 3 } };
    const saved = session({ settings: { ...DEFAULT_SETTINGS, cardSlots: perWheel } });
    window.localStorage.setItem(`playlane:ceremony:${TID}`, JSON.stringify(saved));

    expect(loadSession(TID)?.settings.cardSlots).toEqual(perWheel);
  });

  it("clears on demand", () => {
    saveSession(TID, session());
    clearSession(TID);
    expect(loadSession(TID)).toBeNull();
  });
});
