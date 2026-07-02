import { describe, expect, it } from "vitest";

import {
  activityActionLabel,
  applyMatchQueueFilters,
  buildScorePayload,
  courtLabel,
  courtOptions,
  DEFAULT_MATCH_QUEUE_FILTERS,
  emptyScoreForm,
  groupOptions,
  roundOptions,
  stageOptions,
  stepFocusId,
  validateScoreForm,
} from "@/features/matches/config";
import { makeMatch, makeParticipant, makeStage } from "@/test/fixtures";

describe("applyMatchQueueFilters", () => {
  const p1 = makeParticipant({ id: "p-1", displayName: "Aarav K." });
  const p2 = makeParticipant({ id: "p-2", displayName: "Mei L." });
  const participantsById = new Map([
    [p1.id, p1],
    [p2.id, p2],
  ]);
  const side = (id: string) => ({ participantId: id, outcome: null, scoreFor: null, scoreAgainst: null, rank: null });

  const matches = [
    makeMatch({
      id: "m-1",
      stageId: "stage-1",
      roundId: "r-1",
      groupId: null,
      status: "scheduled",
      courtId: "court-1",
      sides: [side(p1.id), side(p2.id)],
    }),
    makeMatch({
      id: "m-2",
      stageId: "stage-2",
      roundId: "r-2",
      groupId: "g-1",
      status: "completed",
      courtId: null,
      sides: [side(p2.id), side(p1.id)],
    }),
  ];

  it("returns everything when every filter is 'all'", () => {
    expect(applyMatchQueueFilters(matches, DEFAULT_MATCH_QUEUE_FILTERS, participantsById)).toHaveLength(2);
  });

  it("filters by stage", () => {
    const result = applyMatchQueueFilters(
      matches,
      { ...DEFAULT_MATCH_QUEUE_FILTERS, stageId: "stage-1" },
      participantsById,
    );
    expect(result.map((m) => m.id)).toEqual(["m-1"]);
  });

  it("filters by status", () => {
    const result = applyMatchQueueFilters(
      matches,
      { ...DEFAULT_MATCH_QUEUE_FILTERS, status: "completed" },
      participantsById,
    );
    expect(result.map((m) => m.id)).toEqual(["m-2"]);
  });

  it("filters unassigned court matches distinctly from a specific court", () => {
    const assigned = applyMatchQueueFilters(
      matches,
      { ...DEFAULT_MATCH_QUEUE_FILTERS, courtId: "court-1" },
      participantsById,
    );
    expect(assigned.map((m) => m.id)).toEqual(["m-1"]);

    const unassigned = applyMatchQueueFilters(
      matches,
      { ...DEFAULT_MATCH_QUEUE_FILTERS, courtId: "unassigned" },
      participantsById,
    );
    expect(unassigned.map((m) => m.id)).toEqual(["m-2"]);
  });

  it("searches by participant display name, case-insensitively", () => {
    const result = applyMatchQueueFilters(
      matches,
      { ...DEFAULT_MATCH_QUEUE_FILTERS, search: "aarav" },
      participantsById,
    );
    expect(result.map((m) => m.id)).toEqual(["m-1", "m-2"]); // Aarav plays in both
  });

  it("combines multiple filters with AND semantics", () => {
    const result = applyMatchQueueFilters(
      matches,
      { ...DEFAULT_MATCH_QUEUE_FILTERS, search: "aarav", status: "completed" },
      participantsById,
    );
    expect(result.map((m) => m.id)).toEqual(["m-2"]);
  });
});

describe("filter option builders", () => {
  it("stageOptions labels by format + 1-indexed seq, ordered by seq", () => {
    const stages = [
      makeStage({ id: "s-2", type: "single_elim", seq: 1 }),
      makeStage({ id: "s-1", type: "round_robin", seq: 0 }),
    ];
    expect(stageOptions(stages)).toEqual([
      { value: "s-1", label: "Round Robin · Stage 1" },
      { value: "s-2", label: "Single Elimination · Stage 2" },
    ]);
  });

  it("roundOptions dedupes by roundId and orders by roundSeq", () => {
    const matches = [
      makeMatch({ roundId: "r-2", roundSeq: 2, roundLabel: "Final" }),
      makeMatch({ roundId: "r-1", roundSeq: 1, roundLabel: "Semifinal" }),
      makeMatch({ roundId: "r-1", roundSeq: 1, roundLabel: "Semifinal" }),
    ];
    expect(roundOptions(matches)).toEqual([
      { value: "r-1", label: "Semifinal" },
      { value: "r-2", label: "Final" },
    ]);
  });

  it("groupOptions dedupes by groupId and orders alphabetically by label", () => {
    const matches = [
      makeMatch({ groupId: "g-2", groupName: "Pool B" }),
      makeMatch({ groupId: "g-1", groupName: "Pool A" }),
    ];
    expect(groupOptions(matches)).toEqual([
      { value: "g-1", label: "Pool A" },
      { value: "g-2", label: "Pool B" },
    ]);
  });

  it("courtOptions only includes assigned courts", () => {
    const matches = [makeMatch({ courtId: "court-9" }), makeMatch({ courtId: null })];
    expect(courtOptions(matches)).toEqual([{ value: "court-9", label: courtLabel("court-9") }]);
  });

  it("courtLabel falls back to Unassigned for null", () => {
    expect(courtLabel(null)).toBe("Unassigned");
  });
});

describe("stepFocusId", () => {
  const ids = ["a", "b", "c"];

  it("starts at the first id moving forward from nothing focused", () => {
    expect(stepFocusId(ids, null, 1)).toBe("a");
  });

  it("starts at the last id moving backward from nothing focused", () => {
    expect(stepFocusId(ids, null, -1)).toBe("c");
  });

  it("steps forward and backward", () => {
    expect(stepFocusId(ids, "a", 1)).toBe("b");
    expect(stepFocusId(ids, "b", -1)).toBe("a");
  });

  it("clamps at the edges instead of wrapping", () => {
    expect(stepFocusId(ids, "c", 1)).toBe("c");
    expect(stepFocusId(ids, "a", -1)).toBe("a");
  });

  it("returns null for an empty list", () => {
    expect(stepFocusId([], null, 1)).toBeNull();
  });
});

describe("buildScorePayload", () => {
  it("builds a normal result from filled games only", () => {
    const values = emptyScoreForm();
    values.games = [
      { a: 21, b: 15 },
      { a: 21, b: 18 },
      { a: null, b: null },
    ];
    expect(buildScorePayload(values)).toEqual({
      endedBy: "normal",
      games: [
        [21, 15],
        [21, 18],
      ],
    });
  });

  it("builds a walkover payload", () => {
    const values = emptyScoreForm();
    values.resultType = "walkover";
    values.winnerSide = 0;
    expect(buildScorePayload(values)).toEqual({ endedBy: "walkover", walkoverWinner: 0 });
  });

  it("builds a no_show payload", () => {
    const values = emptyScoreForm();
    values.resultType = "no_show";
    values.winnerSide = 1;
    expect(buildScorePayload(values)).toEqual({ endedBy: "no_show", walkoverWinner: 1 });
  });

  it("builds a retirement payload with partial games", () => {
    const values = emptyScoreForm();
    values.resultType = "retirement";
    values.retiredSide = 1;
    values.games = [{ a: 21, b: 15 }, { a: 18, b: 20 }];
    expect(buildScorePayload(values)).toEqual({
      endedBy: "retirement",
      retiredSide: 1,
      games: [
        [21, 15],
        [18, 20],
      ],
    });
  });
});

describe("validateScoreForm", () => {
  it("requires at least one filled game for a normal result", () => {
    const values = emptyScoreForm();
    expect(validateScoreForm(values)).toMatch(/enter at least one/i);
  });

  it("accepts a normal result once a game is filled", () => {
    const values = emptyScoreForm();
    values.games[0] = { a: 21, b: 15 };
    expect(validateScoreForm(values)).toBeNull();
  });

  it("requires a winner side for walkover", () => {
    const values = emptyScoreForm();
    values.resultType = "walkover";
    expect(validateScoreForm(values)).toMatch(/choose which side/i);
    values.winnerSide = 0;
    expect(validateScoreForm(values)).toBeNull();
  });

  it("requires a retired side for retirement", () => {
    const values = emptyScoreForm();
    values.resultType = "retirement";
    expect(validateScoreForm(values)).toMatch(/choose which side/i);
  });

  it("rejects negative scores", () => {
    const values = emptyScoreForm();
    values.games[0] = { a: -1, b: 15 };
    expect(validateScoreForm(values)).toMatch(/can't be negative/i);
  });
});

describe("activityActionLabel", () => {
  it("returns known labels", () => {
    expect(activityActionLabel("match.completed")).toBe("Match completed");
    expect(activityActionLabel("stage.generated")).toBe("Draw generated");
  });

  it("falls back to the raw action string", () => {
    expect(activityActionLabel("mystery.event")).toBe("mystery.event");
  });
});
