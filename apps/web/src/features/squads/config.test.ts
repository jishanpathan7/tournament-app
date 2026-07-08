import { describe, expect, it } from "vitest";

import { computeWorkflowState } from "@/features/squads/config";
import type { SquadView } from "@/features/squads/types";

function squad(id: string, name: string): SquadView {
  return {
    id,
    name,
    sortOrder: 0,
    memberCount: 10,
    totalSkillWeight: 20,
    members: [],
    captainRegistrationId: null,
  };
}

describe("computeWorkflowState", () => {
  it("prioritizes generate over review for next squad", () => {
    const squads = [squad("t1", "Team 1"), squad("t2", "Team 2")];
    const statuses = new Map([
      ["t1", "draft"],
      ["t2", "none"],
    ] as const);

    const state = computeWorkflowState(squads, 0, statuses);

    expect(state.generatedCount).toBe(1);
    expect(state.draftCount).toBe(1);
    expect(state.pairedCount).toBe(0);
    expect(state.nextSquad?.id).toBe("t2");
    expect(state.nextSquadAction).toBe("generate");
  });

  it("is ready for draw when all squads have draft pairs (lock happens at generate matches)", () => {
    const squads = [squad("t1", "Team 1"), squad("t2", "Team 2")];
    const statuses = new Map([
      ["t1", "draft"],
      ["t2", "draft"],
    ] as const);

    const state = computeWorkflowState(squads, 0, statuses);

    expect(state.generatedCount).toBe(2);
    expect(state.pairedCount).toBe(0);
    expect(state.teamsPaired).toBe(true);
    expect(state.readyForDraw).toBe(true);
    expect(state.allPairsLocked).toBe(false);
    expect(state.nextSquad).toBeNull();
    expect(state.currentStep).toBe(3);
  });

  it("marks all pairs locked when every squad is published", () => {
    const squads = [squad("t1", "Team 1")];
    const statuses = new Map([["t1", "published"]] as const);

    const state = computeWorkflowState(squads, 0, statuses);

    expect(state.teamsPaired).toBe(true);
    expect(state.readyForDraw).toBe(true);
    expect(state.allPairsLocked).toBe(true);
    expect(state.currentStep).toBe(3);
    expect(state.nextSquad).toBeNull();
  });
});
