import type {
  DivisionResponse,
  MatchView,
  MemberItem,
  ParticipantResponse,
  RegistrationResponse,
  StageResponse,
  TeamResponse,
  TournamentResponse,
} from "@tournament/api-client";

let seq = 0;

/** Build a TournamentResponse with sensible defaults for tests. */
export function makeTournament(overrides: Partial<TournamentResponse> = {}): TournamentResponse {
  seq += 1;
  return {
    id: overrides.id ?? `t-${seq}`,
    slug: overrides.slug ?? `tournament-${seq}`,
    name: overrides.name ?? `Tournament ${seq}`,
    sportKey: overrides.sportKey ?? "badminton",
    status: overrides.status ?? "draft",
    visibility: overrides.visibility ?? "private",
    startsAt: overrides.startsAt ?? null,
    endsAt: overrides.endsAt ?? null,
    settings: overrides.settings ?? {},
    drawPublishedAt: overrides.drawPublishedAt ?? null,
    schedulePublishedAt: overrides.schedulePublishedAt ?? null,
    resultsPublishedAt: overrides.resultsPublishedAt ?? null,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00Z",
  };
}

/** Build a RegistrationResponse with sensible defaults for tests. */
export function makeRegistration(
  overrides: Partial<RegistrationResponse> = {},
): RegistrationResponse {
  seq += 1;
  return {
    id: overrides.id ?? `r-${seq}`,
    divisionId: overrides.divisionId ?? "div-1",
    submittedBy: overrides.submittedBy ?? "user-1",
    status: overrides.status ?? "submitted",
    skillLevel: overrides.skillLevel ?? null,
    participantId: overrides.participantId ?? null,
    formResponse: overrides.formResponse ?? {},
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00Z",
  };
}

export function makeParticipant(overrides: Partial<ParticipantResponse> = {}): ParticipantResponse {
  seq += 1;
  return {
    id: overrides.id ?? `p-${seq}`,
    divisionId: overrides.divisionId ?? "div-1",
    kind: overrides.kind ?? "individual",
    displayName: overrides.displayName ?? `Participant ${seq}`,
    seed: overrides.seed ?? null,
    status: overrides.status ?? "approved",
    userId: overrides.userId ?? null,
    teamId: overrides.teamId ?? null,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00Z",
  };
}

export function makeMember(overrides: Partial<MemberItem> = {}): MemberItem {
  seq += 1;
  return {
    userId: overrides.userId ?? `user-${seq}`,
    email: overrides.email ?? `member-${seq}@example.com`,
    name: overrides.name ?? `Member ${seq}`,
    role: overrides.role ?? "organizer",
    joinedAt: overrides.joinedAt ?? "2026-01-01T00:00:00Z",
  };
}

export function makeDivision(overrides: Partial<DivisionResponse> = {}): DivisionResponse {
  seq += 1;
  return {
    id: overrides.id ?? `div-${seq}`,
    tournamentId: overrides.tournamentId ?? "t-1",
    name: overrides.name ?? `Division ${seq}`,
    participantType: overrides.participantType ?? "individual",
    capacity: overrides.capacity ?? null,
    regForm: overrides.regForm ?? {},
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00Z",
  };
}

export function makeTeam(overrides: Partial<TeamResponse> = {}): TeamResponse {
  seq += 1;
  return {
    id: overrides.id ?? `team-${seq}`,
    name: overrides.name ?? `Team ${seq}`,
    captainUserId: overrides.captainUserId ?? null,
    roster: overrides.roster ?? [],
  };
}

export function makeStage(overrides: Partial<StageResponse> = {}): StageResponse {
  seq += 1;
  return {
    id: overrides.id ?? `stage-${seq}`,
    divisionId: overrides.divisionId ?? "div-1",
    type: overrides.type ?? "round_robin",
    seq: overrides.seq ?? 0,
    config: overrides.config ?? {},
    advancesN: overrides.advancesN ?? null,
    drawn: overrides.drawn ?? false,
    locked: overrides.locked ?? false,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00Z",
  };
}

export function makeMatch(overrides: Partial<MatchView> = {}): MatchView {
  seq += 1;
  return {
    id: overrides.id ?? `match-${seq}`,
    stageId: overrides.stageId ?? "stage-1",
    status: overrides.status ?? "pending",
    sides: overrides.sides ?? [],
    resultPayload: overrides.resultPayload ?? {},
    roundId: overrides.roundId ?? null,
    roundSeq: overrides.roundSeq ?? null,
    roundLabel: overrides.roundLabel ?? null,
    groupId: overrides.groupId ?? null,
    groupName: overrides.groupName ?? null,
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00Z",
  };
}
