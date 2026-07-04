import type {
  DivisionResponse,
  MemberItem,
  ParticipantAttendanceView,
  RegistrationResponse,
} from "@tournament/api-client";

import { registrationEntrantLabel } from "@/features/registrations/config";

export interface PlayerRow {
  id: string;
  participantId: string | null;
  divisionId: string;
  divisionName: string;
  displayName: string;
  rating: string | null;
  gender: string | null;
  status: string;
  attendance: string | null;
  paid: boolean | null;
  skillLevel: string | null;
  registration: RegistrationResponse;
}

export interface PlayerStats {
  total: number;
  confirmed: number;
  checkedIn: number;
  needsReview: number;
}

const SKILL_RATING: Record<string, string> = {
  advanced: "1820",
  intermediate: "1500",
  beginner: "1200",
};

export function playerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function formString(formResponse: Record<string, unknown>, key: string): string | null {
  const value = formResponse[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function playerRating(registration: RegistrationResponse): string | null {
  const fromForm = formString(registration.formResponse, "rating");
  if (fromForm) return fromForm;
  if (registration.skillLevel) return SKILL_RATING[registration.skillLevel] ?? registration.skillLevel;
  return null;
}

export function playerGender(registration: RegistrationResponse): string | null {
  const raw =
    formString(registration.formResponse, "gender") ??
    formString(registration.formResponse, "sex");
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.startsWith("m")) return "M";
  if (lower.startsWith("f")) return "F";
  return raw.slice(0, 1).toUpperCase();
}

export function playerPaid(registration: RegistrationResponse): boolean | null {
  const paid = registration.formResponse.paid;
  if (typeof paid === "boolean") return paid;
  if (paid === "yes" || paid === "true") return true;
  if (paid === "no" || paid === "false") return false;
  if (registration.status === "approved") return true;
  return null;
}

export function playerStatusLabel(status: string): string {
  switch (status) {
    case "approved":
      return "Confirmed";
    case "submitted":
      return "Pending";
    case "waitlisted":
      return "Waitlisted";
    case "rejected":
      return "Rejected";
    case "withdrawn":
      return "Withdrawn";
    default:
      return status;
  }
}

export function derivePlayerStats(rows: PlayerRow[]): PlayerStats {
  return {
    total: rows.filter((r) => r.status !== "withdrawn" && r.status !== "rejected").length,
    confirmed: rows.filter((r) => r.status === "approved").length,
    checkedIn: rows.filter((r) => r.attendance === "checked_in").length,
    needsReview: rows.filter((r) => r.status === "submitted").length,
  };
}

export function buildPlayerRows(
  divisions: DivisionResponse[],
  registrationsByDivision: Map<string, RegistrationResponse[]>,
  attendanceByDivision: Map<string, ParticipantAttendanceView[]>,
  membersById: Map<string, MemberItem>,
): PlayerRow[] {
  const divisionById = new Map(divisions.map((d) => [d.id, d]));
  const rows: PlayerRow[] = [];

  for (const [divisionId, registrations] of registrationsByDivision) {
    const division = divisionById.get(divisionId);
    if (!division) continue;

    const attendanceByParticipant = new Map(
      (attendanceByDivision.get(divisionId) ?? []).map((a) => [a.id, a]),
    );

    for (const registration of registrations) {
      const attendance = registration.participantId
        ? (attendanceByParticipant.get(registration.participantId) ?? null)
        : null;

      rows.push({
        id: registration.id,
        participantId: registration.participantId,
        divisionId,
        divisionName: division.name,
        displayName: registrationEntrantLabel(registration, membersById),
        rating: playerRating(registration),
        gender: playerGender(registration),
        status: registration.status,
        attendance: attendance?.attendance ?? null,
        paid: playerPaid(registration),
        skillLevel: registration.skillLevel,
        registration,
      });
    }
  }

  return rows.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export type PlayerSkillFilter = "all" | "beginner" | "intermediate" | "advanced";

export function filterPlayerRows(
  rows: PlayerRow[],
  search: string,
  skill: PlayerSkillFilter,
): PlayerRow[] {
  const q = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (skill !== "all" && row.skillLevel !== skill) return false;
    if (!q) return true;
    return (
      row.displayName.toLowerCase().includes(q) ||
      row.divisionName.toLowerCase().includes(q) ||
      (row.rating?.toLowerCase().includes(q) ?? false)
    );
  });
}
