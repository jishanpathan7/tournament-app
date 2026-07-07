import { describe, expect, it } from "vitest";

import {
  bucketMatches,
  conflictLabel,
  conflictsForMatch,
  isHardConflict,
  isTerminal,
  matchParticipantLabel,
  suggestNextSlot,
  toDatetimeLocalValue,
} from "@/features/scheduling/config";
import { makeMatch, makeParticipant } from "@/test/fixtures";

describe("bucketMatches", () => {
  it("buckets pending matches separately from ready ones", () => {
    const pending = makeMatch({ id: "m-pending", status: "pending" });
    const ready = makeMatch({ id: "m-ready", status: "scheduled" });
    const { pending: pendingBucket, unscheduled } = bucketMatches([pending, ready]);
    expect(pendingBucket).toEqual([pending]);
    expect(unscheduled).toEqual([ready]);
  });

  it("buckets a ready match with no court/time as unscheduled", () => {
    const match = makeMatch({ status: "scheduled", courtId: null, scheduledAt: null });
    const { unscheduled, byCourt } = bucketMatches([match]);
    expect(unscheduled).toEqual([match]);
    expect(byCourt.size).toBe(0);
  });

  it("groups matches with a court + time under that court, sorted by time", () => {
    const later = makeMatch({
      id: "m-later",
      status: "scheduled",
      courtId: "court-1",
      scheduledAt: "2026-07-25T10:00:00Z",
    });
    const earlier = makeMatch({
      id: "m-earlier",
      status: "scheduled",
      courtId: "court-1",
      scheduledAt: "2026-07-25T09:00:00Z",
    });
    const { byCourt } = bucketMatches([later, earlier]);
    expect(byCourt.get("court-1")?.map((m) => m.id)).toEqual(["m-earlier", "m-later"]);
  });

  it("sorts the unscheduled bucket by round sequence", () => {
    const round2 = makeMatch({ id: "m-r2", status: "scheduled", roundSeq: 2 });
    const round1 = makeMatch({ id: "m-r1", status: "scheduled", roundSeq: 1 });
    const { unscheduled } = bucketMatches([round2, round1]);
    expect(unscheduled.map((m) => m.id)).toEqual(["m-r1", "m-r2"]);
  });
});

describe("isTerminal", () => {
  it("treats completed/walkover/no_show/cancelled as terminal", () => {
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("walkover")).toBe(true);
    expect(isTerminal("no_show")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
  });

  it("treats scheduled/live/pending as not terminal", () => {
    expect(isTerminal("scheduled")).toBe(false);
    expect(isTerminal("live")).toBe(false);
    expect(isTerminal("pending")).toBe(false);
  });
});

describe("suggestNextSlot", () => {
  it("suggests right after the last match already on the court", () => {
    const last = makeMatch({ scheduledAt: "2026-07-25T09:00:00Z" });
    const slot = suggestNextSlot([last], 30, null);
    expect(slot.toISOString()).toBe("2026-07-25T09:30:00.000Z");
  });

  it("falls back to the tournament start time when the court is empty", () => {
    const slot = suggestNextSlot([], 30, "2026-07-25T08:00:00Z");
    expect(slot.toISOString()).toBe("2026-07-25T08:00:00.000Z");
  });

  it("falls back to now when there's no court history and no tournament start", () => {
    const before = Date.now();
    const slot = suggestNextSlot([], 30, null);
    expect(slot.getTime()).toBeGreaterThanOrEqual(before);
  });
});

describe("matchParticipantLabel", () => {
  it("joins two participants' display names with 'vs'", () => {
    const p1 = makeParticipant({ id: "p-1", displayName: "Aarav K." });
    const p2 = makeParticipant({ id: "p-2", displayName: "Mei L." });
    const match = makeMatch({
      sides: [
        { participantId: "p-1", outcome: null, scoreFor: null, scoreAgainst: null, rank: null },
        { participantId: "p-2", outcome: null, scoreFor: null, scoreAgainst: null, rank: null },
      ],
    });
    const byId = new Map([
      ["p-1", p1],
      ["p-2", p2],
    ]);
    expect(matchParticipantLabel(match, byId)).toBe("Aarav K. vs Mei L.");
  });

  it("shows TBD for a side with no resolved participant lookup", () => {
    const match = makeMatch({
      sides: [
        { participantId: "p-1", outcome: null, scoreFor: null, scoreAgainst: null, rank: null },
      ],
    });
    expect(matchParticipantLabel(match, new Map())).toBe("TBD");
  });
});

describe("conflictLabel / isHardConflict", () => {
  it("labels every known conflict kind", () => {
    expect(conflictLabel("court_overlap")).toBe("Court double-booked");
    expect(conflictLabel("participant_overlap")).toBe("Participant double-booked");
    expect(conflictLabel("unresolved_match")).toBe("Bracket not resolved yet");
  });

  it("falls back to the raw kind when unknown", () => {
    expect(conflictLabel("something_new")).toBe("something_new");
  });

  it("classifies structural conflicts as hard, overlaps as soft", () => {
    expect(isHardConflict("court_unassigned")).toBe(true);
    expect(isHardConflict("court_unavailable")).toBe(true);
    expect(isHardConflict("unresolved_match")).toBe(true);
    expect(isHardConflict("outside_tournament_window")).toBe(true);
    expect(isHardConflict("court_overlap")).toBe(false);
    expect(isHardConflict("participant_overlap")).toBe(false);
    expect(isHardConflict("team_overlap")).toBe(false);
  });
});

describe("conflictsForMatch", () => {
  it("filters conflicts down to the given match id", () => {
    const conflicts = [
      {
        kind: "court_overlap",
        matchId: "m-1",
        otherMatchId: "m-2",
        participantId: null,
        message: "x",
      },
      {
        kind: "court_overlap",
        matchId: "m-2",
        otherMatchId: "m-1",
        participantId: null,
        message: "x",
      },
    ];
    expect(conflictsForMatch(conflicts, "m-1")).toEqual([conflicts[0]]);
  });
});

describe("toDatetimeLocalValue", () => {
  it("formats a Date as a zero-padded local datetime-local value", () => {
    const date = new Date(2026, 6, 25, 9, 5); // months are 0-indexed: July
    expect(toDatetimeLocalValue(date)).toBe("2026-07-25T09:05");
  });
});
