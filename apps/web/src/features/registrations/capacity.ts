import type { ParticipantResponse, RegistrationResponse } from "@tournament/api-client";

export interface CapacitySummary {
  capacity: number | null;
  approved: number;
  waitlisted: number;
  pending: number;
  rejected: number;
  withdrawn: number;
  /** `null` when the division has no capacity limit. */
  remaining: number | null;
  /** True once approving another entrant would land on the waitlist. */
  isFull: boolean;
}

/**
 * Derive capacity/waitlist/pending counts client-side — there is no dedicated backend
 * endpoint for this. Mirrors the backend's own rule exactly: "approved" is counted from
 * Participants (an approved registration always has one), matching
 * `registrations/repository.py::count_approved`. Pending/waitlisted/rejected/withdrawn
 * come from Registrations, since a waitlisted/pending entrant has no Participant row yet.
 */
export function deriveCapacity(
  capacity: number | null,
  registrations: RegistrationResponse[],
  participants: ParticipantResponse[],
): CapacitySummary {
  const approved = participants.filter((p) => p.status === "approved").length;
  const waitlisted = registrations.filter((r) => r.status === "waitlisted").length;
  const pending = registrations.filter((r) => r.status === "submitted").length;
  const rejected = registrations.filter((r) => r.status === "rejected").length;
  const withdrawn = registrations.filter((r) => r.status === "withdrawn").length;
  const remaining = capacity === null ? null : Math.max(0, capacity - approved);

  return {
    capacity,
    approved,
    waitlisted,
    pending,
    rejected,
    withdrawn,
    remaining,
    isFull: capacity !== null && approved >= capacity,
  };
}
