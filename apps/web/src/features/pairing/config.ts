import type { EntrantView, PairingRunView, ProposedTeamView } from "@tournament/api-client";

import type { BadgeProps } from "@/components/ui/badge";

type Tone = NonNullable<BadgeProps["tone"]>;

/** Skill tiers → label + tone (mirrors the badminton profile's beginner/intermediate/
 * advanced weights). The numeric weight lives on the backend; here it's presentation. */
export const SKILL_META: Record<string, { label: string; tone: Tone }> = {
  advanced: { label: "Advanced", tone: "pink" },
  intermediate: { label: "Intermediate", tone: "candy" },
  beginner: { label: "Beginner", tone: "mint" },
};

export function skillMeta(skill: string | null | undefined): { label: string; tone: Tone } {
  if (!skill) return { label: "Unrated", tone: "muted" };
  return SKILL_META[skill] ?? { label: skill, tone: "muted" };
}

/** Confidence (0..1) → a tone + label band for the team-strength visualization. */
export function confidenceMeta(confidence: number): { label: string; tone: Tone; pct: number } {
  const pct = Math.round(confidence * 100);
  if (confidence >= 0.85) return { label: "Balanced", tone: "mint", pct };
  if (confidence >= 0.6) return { label: "Fair", tone: "candy", pct };
  if (confidence >= 0.35) return { label: "Uneven", tone: "yellow", pct };
  return { label: "Lopsided", tone: "pink", pct };
}

/** A fast id→entrant lookup for rendering team members by name/skill. */
export function entrantsById(run: PairingRunView): Map<string, EntrantView> {
  return new Map(run.entrants.map((e) => [e.registrationId, e]));
}

export function entrantName(run: PairingRunView, registrationId: string): string {
  return entrantsById(run).get(registrationId)?.displayName ?? "Unknown";
}

/** Teams sorted for display: locked first, then weakest-confidence first so the
 * arrangements most worth an organizer's attention rise to the top. */
export function sortedTeams(run: PairingRunView): ProposedTeamView[] {
  return [...run.teams].sort((a, b) => {
    if (a.locked !== b.locked) return a.locked ? -1 : 1;
    return a.confidence - b.confidence;
  });
}

export interface PairingStats {
  teamCount: number;
  entrantCount: number;
  unpairedCount: number;
  averageConfidence: number;
  lockedCount: number;
}

export function pairingStats(run: PairingRunView): PairingStats {
  return {
    teamCount: run.summary.teamCount,
    entrantCount: run.summary.entrantCount,
    unpairedCount: run.summary.unpairedCount,
    averageConfidence: run.summary.averageConfidence,
    lockedCount: run.teams.filter((t) => t.locked).length,
  };
}
