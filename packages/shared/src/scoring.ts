import type { SkillLevel } from "./types";

/**
 * The fairness engine's skill weights (see Tournament-Playbook.md):
 * beginner = 1, intermediate = 2, advanced = 3.
 */
export const SKILL_WEIGHT: Record<SkillLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

/** Weight for a single player's skill level. */
export function skillWeight(level: SkillLevel): number {
  return SKILL_WEIGHT[level];
}

/** Combined strength of a doubles pair (range 2–6; midpoint 4 is the fairest target). */
export function teamStrength(a: SkillLevel, b: SkillLevel): number {
  return skillWeight(a) + skillWeight(b);
}

/** Human label for a pair's balance, used in pairing UIs. */
export function balanceLabel(strength: number): "developing" | "balanced" | "strong" {
  if (strength >= 5) return "strong";
  if (strength === 4) return "balanced";
  return "developing";
}
