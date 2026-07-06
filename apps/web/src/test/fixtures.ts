import type {
  ActivityEventView,
  CourtQueueView,
  CourtView,
  DivisionResponse,
  EntrantView,
  MatchResultEventView,
  MatchView,
  MemberItem,
  PairingRunView,
  ParticipantResponse,
  ProposedTeamView,
  PublicDivisionView,
  PublicParticipantView,
  PublicStageView,
  PublicTournamentView,
  RegistrationResponse,
  ScheduleQueueView,
  StageResponse,
  TeamResponse,
  TournamentCourtView,
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
    venueName: overrides.venueName ?? null,
    venue: overrides.venue ?? null,
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
    courtId: overrides.courtId ?? null,
    scheduledAt: overrides.scheduledAt ?? null,
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00Z",
    parentMatchId: overrides.parentMatchId ?? null,
    contestKind: overrides.contestKind ?? "standard",
  };
}

export function makeMatchResultEvent(
  overrides: Partial<MatchResultEventView> = {},
): MatchResultEventView {
  seq += 1;
  return {
    id: overrides.id ?? `event-${seq}`,
    matchId: overrides.matchId ?? "match-1",
    type: overrides.type ?? "normal",
    payload: overrides.payload ?? {},
    actorId: overrides.actorId ?? "user-1",
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00Z",
  };
}

export function makeActivityEvent(
  overrides: Partial<ActivityEventView> = {},
): ActivityEventView {
  seq += 1;
  return {
    id: overrides.id ?? `activity-${seq}`,
    action: overrides.action ?? "match.completed",
    entity: overrides.entity ?? "match",
    entityId: overrides.entityId ?? "match-1",
    actorId: overrides.actorId ?? "user-1",
    before: overrides.before ?? null,
    after: overrides.after ?? null,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00Z",
  };
}

export function makePublicTournament(
  overrides: Partial<PublicTournamentView> = {},
): PublicTournamentView {
  seq += 1;
  return {
    id: overrides.id ?? `t-${seq}`,
    slug: overrides.slug ?? `tournament-${seq}`,
    name: overrides.name ?? `Tournament ${seq}`,
    sportKey: overrides.sportKey ?? "badminton",
    status: overrides.status ?? "registration",
    visibility: overrides.visibility ?? "public",
    startsAt: overrides.startsAt ?? null,
    endsAt: overrides.endsAt ?? null,
    venueName: overrides.venueName ?? null,
    venue: overrides.venue ?? null,
    drawPublishedAt: overrides.drawPublishedAt ?? null,
    schedulePublishedAt: overrides.schedulePublishedAt ?? null,
    resultsPublishedAt: overrides.resultsPublishedAt ?? null,
    organization: overrides.organization ?? {
      slug: "org",
      name: "Org",
      branding: {},
    },
  };
}

export function makePublicDivision(
  overrides: Partial<PublicDivisionView> = {},
): PublicDivisionView {
  seq += 1;
  return {
    id: overrides.id ?? `div-${seq}`,
    name: overrides.name ?? `Division ${seq}`,
    participantType: overrides.participantType ?? "individual",
    capacity: overrides.capacity ?? null,
    approvedCount: overrides.approvedCount ?? 0,
  };
}

export function makePublicStage(overrides: Partial<PublicStageView> = {}): PublicStageView {
  seq += 1;
  return {
    id: overrides.id ?? `stage-${seq}`,
    divisionId: overrides.divisionId ?? "div-1",
    type: overrides.type ?? "round_robin",
    seq: overrides.seq ?? 0,
    drawn: overrides.drawn ?? false,
  };
}

export function makePublicParticipant(
  overrides: Partial<PublicParticipantView> = {},
): PublicParticipantView {
  seq += 1;
  return {
    id: overrides.id ?? `p-${seq}`,
    divisionId: overrides.divisionId ?? "div-1",
    kind: overrides.kind ?? "individual",
    displayName: overrides.displayName ?? `Participant ${seq}`,
    seed: overrides.seed ?? null,
  };
}

export function makeCourt(overrides: Partial<CourtView> = {}): CourtView {
  seq += 1;
  return {
    id: overrides.id ?? `court-${seq}`,
    venueId: overrides.venueId ?? "venue-1",
    venueName: overrides.venueName ?? "Main Gym",
    name: overrides.name ?? `Court ${seq}`,
    status: overrides.status ?? "active",
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00Z",
  };
}

export function makeTournamentCourt(
  overrides: Partial<TournamentCourtView> = {},
): TournamentCourtView {
  seq += 1;
  return {
    id: overrides.id ?? `tc-${seq}`,
    tournamentId: overrides.tournamentId ?? "t-1",
    court: overrides.court ?? makeCourt(),
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00Z",
  };
}

export function makeCourtQueue(overrides: Partial<CourtQueueView> = {}): CourtQueueView {
  return {
    court: overrides.court ?? makeCourt(),
    currentMatch: overrides.currentMatch ?? null,
    nextMatch: overrides.nextMatch ?? null,
    isDelayed: overrides.isDelayed ?? false,
  };
}

export function makeScheduleQueue(overrides: Partial<ScheduleQueueView> = {}): ScheduleQueueView {
  return {
    courts: overrides.courts ?? [],
    unscheduled: overrides.unscheduled ?? [],
    pending: overrides.pending ?? [],
  };
}

export function makeEntrant(overrides: Partial<EntrantView> = {}): EntrantView {
  seq += 1;
  return {
    registrationId: overrides.registrationId ?? `reg-${seq}`,
    displayName: overrides.displayName ?? `Player ${seq}`,
    skillLevel: overrides.skillLevel ?? "intermediate",
    weight: overrides.weight ?? 2,
    preferredPartnerId: overrides.preferredPartnerId ?? null,
    squadName: overrides.squadName ?? null,
  };
}

export function makeProposedTeam(overrides: Partial<ProposedTeamView> = {}): ProposedTeamView {
  seq += 1;
  return {
    id: overrides.id ?? `team-${seq}`,
    memberIds: overrides.memberIds ?? [],
    strength: overrides.strength ?? 4,
    confidence: overrides.confidence ?? 1,
    reasons: overrides.reasons ?? [],
    locked: overrides.locked ?? false,
    teamName: overrides.teamName ?? null,
  };
}

export function makePairingRun(overrides: Partial<PairingRunView> = {}): PairingRunView {
  seq += 1;
  const entrants = overrides.entrants ?? [];
  const teams = overrides.teams ?? [];
  return {
    id: overrides.id ?? `run-${seq}`,
    divisionId: overrides.divisionId ?? "div-1",
    status: overrides.status ?? "draft",
    rngSeed: overrides.rngSeed ?? null,
    entrants,
    teams,
    unpairedIds: overrides.unpairedIds ?? [],
    summary: overrides.summary ?? {
      teamCount: teams.length,
      entrantCount: entrants.length,
      unpairedCount: overrides.unpairedIds?.length ?? 0,
      averageConfidence:
        teams.length > 0 ? teams.reduce((s, t) => s + t.confidence, 0) / teams.length : 0,
    },
  };
}
