import { describe, expect, it } from "vitest";

import { deriveCapacity } from "@/features/registrations/capacity";
import { makeParticipant, makeRegistration } from "@/test/fixtures";

describe("deriveCapacity", () => {
  it("has no limit when the division has no capacity", () => {
    const summary = deriveCapacity(null, [makeRegistration({ status: "submitted" })], []);
    expect(summary.capacity).toBeNull();
    expect(summary.remaining).toBeNull();
    expect(summary.isFull).toBe(false);
  });

  it("counts approved from participants, not registrations", () => {
    const registrations = [
      makeRegistration({ status: "approved", participantId: "p-1" }),
      makeRegistration({ status: "submitted" }),
      makeRegistration({ status: "waitlisted" }),
      makeRegistration({ status: "rejected" }),
      makeRegistration({ status: "withdrawn" }),
    ];
    const participants = [makeParticipant({ id: "p-1", status: "approved" })];
    const summary = deriveCapacity(4, registrations, participants);

    expect(summary.approved).toBe(1);
    expect(summary.pending).toBe(1);
    expect(summary.waitlisted).toBe(1);
    expect(summary.rejected).toBe(1);
    expect(summary.withdrawn).toBe(1);
    expect(summary.remaining).toBe(3);
    expect(summary.isFull).toBe(false);
  });

  it("reports full + zero remaining once capacity is met (never negative)", () => {
    const participants = [
      makeParticipant({ status: "approved" }),
      makeParticipant({ status: "approved" }),
    ];
    const summary = deriveCapacity(2, [], participants);
    expect(summary.isFull).toBe(true);
    expect(summary.remaining).toBe(0);
  });

  it("clamps remaining at 0 even if somehow over capacity", () => {
    const participants = [
      makeParticipant({ status: "approved" }),
      makeParticipant({ status: "approved" }),
      makeParticipant({ status: "approved" }),
    ];
    const summary = deriveCapacity(2, [], participants);
    expect(summary.remaining).toBe(0);
    expect(summary.isFull).toBe(true);
  });

  it("ignores non-approved participant statuses (e.g. withdrawn)", () => {
    const participants = [
      makeParticipant({ status: "approved" }),
      makeParticipant({ status: "withdrawn" }),
    ];
    const summary = deriveCapacity(5, [], participants);
    expect(summary.approved).toBe(1);
  });
});
