/**
 * Shared domain types used across web + (mirrored by) the API.
 * Keep these as the single source of truth for cross-cutting enums/unions.
 */

export type SkillLevel = "beginner" | "intermediate" | "advanced";

export type ParticipantKind = "individual" | "pair" | "team" | "squad";

export type MatchStatus = "scheduled" | "live" | "completed" | "walkover" | "no_show" | "cancelled";

export type TournamentStatus =
  "draft" | "registration" | "seeding" | "live" | "completed" | "archived";

export type StageFormat = "round_robin" | "single_elim" | "group_knockout" | "swiss" | "ladder";

// Mirrors apps/api/app/db/enums.py — values must stay byte-for-byte identical
// (the generated API client depends on it). Native Postgres ENUM types back these.

export type OrgRole = "owner" | "admin" | "organizer" | "scorekeeper" | "viewer";

export type Visibility = "public" | "unlisted" | "private";

export type ParticipantStatus =
  "registered" | "approved" | "waitlisted" | "withdrawn" | "rejected" | "checked_in";

export type RegistrationStatus =
  "submitted" | "approved" | "waitlisted" | "rejected" | "withdrawn";

export type MatchOutcome = "win" | "loss" | "draw" | "rank";

export type AssignmentRole = "scorekeeper" | "marshal";

export type ShareLinkScope = "public_view" | "check_in" | "scorekeeper" | "team_invite";

export type NotificationChannel = "email" | "in_app";

export type NotificationStatus = "pending" | "sent" | "delivered" | "failed" | "read";

export type FileKind = "org_logo" | "tournament_logo" | "rules_doc" | "export" | "avatar";

export type FileStatus = "pending" | "ready" | "failed";

export type OrgInviteStatus = "pending" | "accepted" | "revoked" | "expired";

export type IdempotencyStatus = "started" | "completed" | "failed";
