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

  it("clears on demand", () => {
    saveSession(TID, session());
    clearSession(TID);
    expect(loadSession(TID)).toBeNull();
  });
});
