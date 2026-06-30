/**
 * Shared domain types used across web + (mirrored by) the API.
 * Keep these as the single source of truth for cross-cutting enums/unions.
 */

export type SkillLevel = "beginner" | "intermediate" | "advanced";

export type ParticipantKind = "individual" | "pair" | "team";

export type MatchStatus = "scheduled" | "live" | "completed" | "walkover" | "no_show" | "cancelled";

export type TournamentStatus =
  "draft" | "registration" | "seeding" | "live" | "completed" | "archived";

export type StageFormat = "round_robin" | "single_elim" | "group_knockout" | "swiss" | "ladder";
