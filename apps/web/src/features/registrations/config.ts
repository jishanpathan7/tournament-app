import type { MemberItem, ParticipantResponse, RegistrationResponse } from "@tournament/api-client";

import type { BadgeProps } from "@/components/ui/badge";

/** FE mirror of `RegistrationStatus`/`ParticipantStatus` (app/db/enums.py) — labels + tones. */

type Tone = NonNullable<BadgeProps["tone"]>;

export interface StatusMeta {
  label: string;
  tone: Tone;
}

export const REGISTRATION_STATUS: Record<string, StatusMeta> = {
  submitted: { label: "Pending", tone: "candy" },
  approved: { label: "Approved", tone: "mint" },
  waitlisted: { label: "Waitlisted", tone: "yellow" },
  rejected: { label: "Rejected", tone: "pink" },
  withdrawn: { label: "Withdrawn", tone: "muted" },
};

export const PARTICIPANT_STATUS: Record<string, StatusMeta> = {
  registered: { label: "Registered", tone: "candy" },
  approved: { label: "Approved", tone: "mint" },
  waitlisted: { label: "Waitlisted", tone: "yellow" },
  withdrawn: { label: "Withdrawn", tone: "muted" },
  rejected: { label: "Rejected", tone: "pink" },
  checked_in: { label: "Checked in", tone: "mint" },
};

export function statusMeta(status: string): StatusMeta {
  return REGISTRATION_STATUS[status] ?? { label: status, tone: "muted" };
}

/** Statuses an organizer can still act on (mirrors backend `_APPROVABLE`). */
export const ACTIONABLE_STATUSES = new Set(["submitted", "waitlisted"]);

export const REGISTRATION_STATUS_FILTERS = [
  "all",
  "submitted",
  "approved",
  "waitlisted",
  "rejected",
  "withdrawn",
] as const;
export type RegistrationStatusFilter = (typeof REGISTRATION_STATUS_FILTERS)[number];

/** The submitter's display name, or their email, or a short fallback — never a bare UUID. */
export function entrantLabel(submittedBy: string, membersById: Map<string, MemberItem>): string {
  const member = membersById.get(submittedBy);
  return member?.name || member?.email || `Entrant ${submittedBy.slice(0, 8)}`;
}

/** Prefer the imported/self-declared name in formResponse over the submitter account. */
export function registrationEntrantLabel(
  registration: RegistrationResponse,
  membersById: Map<string, MemberItem>,
): string {
  const fromForm = registration.formResponse?.name;
  if (typeof fromForm === "string" && fromForm.trim()) return fromForm.trim();
  return entrantLabel(registration.submittedBy, membersById);
}

/** Team/player names from the opaque `formResponse`, without assuming a sport-specific shape. */
export function formResponseSummary(formResponse: Record<string, unknown>): string | null {
  const teamName = typeof formResponse.teamName === "string" ? formResponse.teamName : null;
  const players = Array.isArray(formResponse.players) ? formResponse.players : null;
  if (teamName) return teamName;
  if (players) {
    const names = players
      .map((p) => (typeof p === "object" && p && "name" in p ? String(p.name) : null))
      .filter((n): n is string => !!n);
    if (names.length > 0) return names.join(" / ");
  }
  return null;
}

/** CSV export of the current registration list — client-side only (no backend export exists). */
export function registrationsToCsv(
  registrations: RegistrationResponse[],
  membersById: Map<string, MemberItem>,
  participantsById: Map<string, ParticipantResponse>,
): string {
  const header = [
    "Entrant",
    "Status",
    "Skill level",
    "Team / partner",
    "Participant",
    "Submitted at",
  ];
  const rows = registrations.map((r) => [
    registrationEntrantLabel(r, membersById),
    statusMeta(r.status).label,
    r.skillLevel ?? "",
    formResponseSummary(r.formResponse) ?? "",
    (r.participantId && participantsById.get(r.participantId)?.displayName) ?? "",
    r.createdAt,
  ]);
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
