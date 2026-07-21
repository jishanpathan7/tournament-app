/** Squad API shapes (camelCase on the wire). */

export interface SquadMemberView {
  registrationId: string;
  displayName: string;
  skillLevel: string | null;
  divisionId: string;
  divisionName: string;
  skillWeight: number;
}

export interface SquadView {
  id: string;
  name: string;
  sortOrder: number;
  captainRegistrationId: string | null;
  memberCount: number;
  totalSkillWeight: number;
  members: SquadMemberView[];
}

export interface UnassignedRegistrationView {
  registrationId: string;
  displayName: string;
  skillLevel: string | null;
  divisionId: string;
  divisionName: string;
  skillWeight: number;
  status: string;
}

/** Atomically trade one member between two squads (both move or neither does). */
export interface SwapMembersRequest {
  squadAId: string;
  registrationAId: string;
  squadBId: string;
  registrationBId: string;
}

export interface SquadSummary {
  squadCount: number;
  assigned: number;
  unassigned: number;
  eligible: number;
}

export interface TournamentSquadsView {
  tournamentId: string;
  squads: SquadView[];
  unassigned: UnassignedRegistrationView[];
  summary: SquadSummary;
}

export interface CreateSquadRequest {
  name: string;
}

export interface UpdateSquadRequest {
  name?: string;
  captainRegistrationId?: string;
  clearCaptain?: boolean;
}

export interface AssignMemberRequest {
  registrationId: string;
}

export interface AutoDistributeRequest {
  teamCount: number;
  divisionId?: string;
  replaceExisting?: boolean;
}

export interface AutoDistributeResponse {
  squads: SquadView[];
  summary: SquadSummary;
}
