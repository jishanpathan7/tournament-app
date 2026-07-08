import type { ParticipantResponse, RegistrationResponse } from "@tournament/api-client";

type RosterParticipant = Pick<ParticipantResponse, "kind" | "status">;

/** Franchise flow: players register individually, then publish pairing adds pair rows. */
export function isFranchisePairedDivision(
  registrations: RegistrationResponse[],
  participants: ParticipantResponse[],
): boolean {
  const hasPairs = participants.some((p) => p.kind === "pair" && p.status === "approved");
  const hasApprovedPlayers = registrations.some((r) => r.status === "approved");
  return hasPairs && hasApprovedPlayers;
}

export function countApprovedPlayers(registrations: RegistrationResponse[]): number {
  return registrations.filter((r) => r.status === "approved").length;
}

export function countCompetitorParticipants(participants: ParticipantResponse[]): {
  pairs: number;
  franchiseTeams: number;
} {
  const approved = participants.filter((p) => p.status === "approved");
  return {
    pairs: approved.filter((p) => p.kind === "pair").length,
    franchiseTeams: approved.filter((p) => p.kind === "squad").length,
  };
}

/** Draw / bracket competitors — pairs and franchise teams, not every staging row. */
export function competitorsForDraw(participants: ParticipantResponse[]): ParticipantResponse[] {
  const approved = participants.filter((p) => p.status === "approved");
  if (approved.some((p) => p.kind === "pair")) {
    return approved.filter((p) => p.kind === "pair" || p.kind === "squad" || p.kind === "team");
  }
  return approved;
}

/** Event-day check-in is per player; hide pair/squad rows once doubles are published. */
export function playersForCheckIn<T extends RosterParticipant>(participants: T[]): T[] {
  const approved = participants.filter((p) => p.status === "approved");
  if (approved.some((p) => p.kind === "pair")) {
    return approved.filter((p) => p.kind === "individual");
  }
  return approved;
}
