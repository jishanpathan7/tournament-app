/**
 * `@tournament/api-client` — the typed contract between the web app and the API.
 *
 * `schema.d.ts` is GENERATED from the backend's OpenAPI (`openapi.json`) via
 * `yarn workspace @tournament/api-client generate` — never hand-edit it, and never
 * hand-write request/response shapes elsewhere. This module only re-exports the
 * generated `paths`/`operations`/`components` and gives the schemas ergonomic aliases.
 *
 * To refresh after backend changes: dump the API's OpenAPI to `openapi.json`, run
 * `generate`, and commit both. Drift is caught at type-check time.
 */
import type { components, operations, paths } from "./schema";

export type { components, operations, paths };

type Schemas = components["schemas"];

// ---- auth / session ----
export type MeResponse = Schemas["MeResponse"];
export type OrgSummary = Schemas["OrgSummary"];
export type SessionItem = Schemas["SessionItem"];
export type LoginRequest = Schemas["LoginRequest"];
export type RegisterRequest = Schemas["RegisterRequest"];
export type ChangePasswordRequest = Schemas["ChangePasswordRequest"];
export type PasswordResetRequest = Schemas["PasswordResetRequest"];
export type PasswordResetConfirmRequest = Schemas["PasswordResetConfirmRequest"];
export type VerifyEmailConfirmRequest = Schemas["VerifyEmailConfirmRequest"];

// ---- organizations / membership ----
export type OrgResponse = Schemas["OrgResponse"];
export type CreateOrgRequest = Schemas["CreateOrgRequest"];
export type UpdateOrgRequest = Schemas["UpdateOrgRequest"];
export type SwitchOrgRequest = Schemas["SwitchOrgRequest"];
export type MemberItem = Schemas["MemberItem"];
export type UpdateMemberRoleRequest = Schemas["UpdateMemberRoleRequest"];
export type InviteItem = Schemas["InviteItem"];
export type CreateInviteRequest = Schemas["CreateInviteRequest"];
export type AcceptInviteRequest = Schemas["AcceptInviteRequest"];

// ---- tournaments / divisions / stages / draws ----
export type TournamentResponse = Schemas["TournamentResponse"];
export type CreateTournamentRequest = Schemas["CreateTournamentRequest"];
export type UpdateTournamentRequest = Schemas["UpdateTournamentRequest"];
export type StatusTransitionRequest = Schemas["StatusTransitionRequest"];
export type PublishRequest = Schemas["PublishRequest"];
export type DivisionResponse = Schemas["DivisionResponse"];
export type CreateDivisionRequest = Schemas["CreateDivisionRequest"];
export type StageResponse = Schemas["StageResponse"];
export type CreateStageRequest = Schemas["CreateStageRequest"];
export type DrawRequest = Schemas["DrawRequest"];
export type DrawResponse = Schemas["DrawResponse"];
export type ActivityEventView = Schemas["ActivityEventView"];

// ---- registrations / participants / teams ----
export type RegistrationResponse = Schemas["RegistrationResponse"];
export type SubmitRegistrationRequest = Schemas["SubmitRegistrationRequest"];
export type ApproveResult = Schemas["ApproveResult"];
export type ParticipantResponse = Schemas["ParticipantResponse"];
export type TeamResponse = Schemas["TeamResponse"];
export type RosterEntryItem = Schemas["RosterEntryItem"];

// ---- scoring / matches / standings ----
export type MatchView = Schemas["MatchView"];
export type MatchSideView = Schemas["MatchSideView"];
export type ScoreRequest = Schemas["ScoreRequest"];
export type MatchResultEventView = Schemas["MatchResultEventView"];
export type StandingsView = Schemas["StandingsView"];
export type StandingRowView = Schemas["StandingRowView"];

// ---- notifications ----
export type NotificationResource = Schemas["NotificationResource"];
export type NotificationPage = Schemas["CursorPage_NotificationResource_"];
export type UnreadCountResponse = Schemas["UnreadCountResponse"];
export type MarkAllReadResponse = Schemas["MarkAllReadResponse"];

// ---- files ----
export type FileResource = Schemas["FileResource"];
export type PresignUploadRequest = Schemas["PresignUploadRequest"];
export type PresignUploadResponse = Schemas["PresignUploadResponse"];

// ---- feature flags ----
export type FeatureFlagResource = Schemas["FeatureFlagResource"];
export type UpsertFeatureFlagRequest = Schemas["UpsertFeatureFlagRequest"];
export type FlagEnabledResponse = Schemas["FlagEnabledResponse"];

// ---- courts / venues / tournament court assignment ----
export type VenueView = Schemas["VenueView"];
export type CreateVenueRequest = Schemas["CreateVenueRequest"];
export type CourtView = Schemas["CourtView"];
export type CreateCourtRequest = Schemas["CreateCourtRequest"];
export type UpdateCourtRequest = Schemas["UpdateCourtRequest"];
export type AssignCourtRequest = Schemas["AssignCourtRequest"];
export type TournamentCourtView = Schemas["TournamentCourtView"];

// ---- scheduling: assign/move a match, conflicts, bulk scheduling, the queue ----
export type ScheduleAssignRequest = Schemas["ScheduleAssignRequest"];
export type ConflictView = Schemas["ConflictView"];
export type ScheduleResultView = Schemas["ScheduleResultView"];
export type ScheduleCheckRequest = Schemas["ScheduleCheckRequest"];
export type ScheduleCheckResponse = Schemas["ScheduleCheckResponse"];
export type BulkScheduleItem = Schemas["BulkScheduleItem"];
export type BulkScheduleRequest = Schemas["BulkScheduleRequest"];
export type BulkScheduleResponse = Schemas["BulkScheduleResponse"];
export type CourtQueueView = Schemas["CourtQueueView"];
export type ScheduleQueueView = Schemas["ScheduleQueueView"];

// ---- public microsite (anonymous — never fields tracing back to a user account) ----
export type PublicOrgView = Schemas["PublicOrgView"];
export type PublicTournamentView = Schemas["PublicTournamentView"];
export type PublicDivisionView = Schemas["PublicDivisionView"];
export type PublicStageView = Schemas["PublicStageView"];
export type PublicParticipantView = Schemas["PublicParticipantView"];
export type PublicTournamentSearchResult = Schemas["PublicTournamentSearchResult"];

// ---- health / errors ----
export type HealthResponse = Schemas["HealthResponse"];

// ---- shared enums (mirror app/db/enums.py; also in @tournament/shared) ----
export type OrgRole = Schemas["OrgRole"];
export type Visibility = Schemas["Visibility"];
export type TournamentStatus = Schemas["TournamentStatus"];
export type StageFormat = Schemas["StageFormat"];
export type ParticipantKind = Schemas["ParticipantKind"];
export type SkillLevel = Schemas["SkillLevel"];
