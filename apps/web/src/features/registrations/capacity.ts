import type { ParticipantResponse, RegistrationResponse } from "@tournament/api-client";

import {
  countApprovedPlayers,
  countCompetitorParticipants,
  isFranchisePairedDivision,
} from "@/features/registrations/franchise-roster";

export interface CapacitySummary {
  capacity: number | null;
  approved: number;
  waitlisted: number;
  pending: number;
  rejected: number;
  withdrawn: number;
  /** Published doubles pairs (franchise flow only). */
  pairs: number;
  /** Franchise squads entered into team ties (franchise flow only). */
  franchiseTeams: number;
  /** `null` when the division has no capacity limit. */
  remaining: number | null;
  /** True once approving another entrant would land on the waitlist. */
  isFull: boolean;
}

/**
 * Derive capacity/waitlist/pending counts client-side — there is no dedicated backend
 * endpoint for this. For standard divisions, "approved" matches
 * `registrations/repository.py::count_approved` (participant rows). In the franchise
 * flow (individual import → squad pairing → team ties), approved **players** are counted
 * from registrations so pair/squad staging rows are not double-counted.
 */
export function deriveCapacity(
  capacity: number | null,
  registrations: RegistrationResponse[],
  participants: ParticipantResponse[],
): CapacitySummary {
  const franchisePaired = isFranchisePairedDivision(registrations, participants);
  const { pairs, franchiseTeams } = countCompetitorParticipants(participants);
  const approved = franchisePaired
    ? countApprovedPlayers(registrations)
    : participants.filter((p) => p.status === "approved").length;
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
    pairs,
    franchiseTeams,
    remaining,
    isFull: capacity !== null && approved >= capacity,
  };
}
