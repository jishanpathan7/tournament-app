/**
 * Fun Draft Mode — ceremony presentation settings.
 *
 * V1 is client-side only: organizers toggle these in the ceremony shell and the
 * defaults below apply. Persisting them on the tournament (so the config sticks
 * across sessions) is a backend follow-up — see the design doc's "Follow-up" list.
 *
 * When Fun Mode is OFF the ceremony runs exactly as the competitive Balanced
 * Draft: no intros, no power slots, no countdown, no wildcard finish. Every fun
 * element is gated behind `funMode` so competitive tournaments are never
 * affected.
 */

import type { SkillKey } from "@/features/squads/components/draft-ceremony/power-slots";

export type CeremonySpeed = "relaxed" | "normal" | "fast";

export interface CeremonySettings {
  /** Master gate. Off = standard Balanced Draft with zero modifiers. */
  funMode: boolean;
  /** Team walk-in sequence before the first spin. */
  teamIntroductions: boolean;
  /** "On the clock" + 3·2·1 countdown before each spin. */
  onTheClock: boolean;
  /** Tier-matched reveal animation + sound (advanced/intermediate/beginner). */
  tieredReveals: boolean;
  /** Master gate for surprise Power Slots woven into the wheel. */
  powerSlots: boolean;
  /** Exactly how many power slots appear on each skill-level wheel (organizer set). */
  powerSlotsBySkill: Record<SkillKey, number>;
  /** Bundle the final three picks into a rapid-fire crescendo. */
  wildcardFinish: boolean;
  /** Playback speed — scales all animation durations. Organizer can change live. */
  speed: CeremonySpeed;
}

export const DEFAULT_SETTINGS: CeremonySettings = {
  funMode: false,
  teamIntroductions: true,
  onTheClock: true,
  tieredReveals: true,
  powerSlots: true,
  powerSlotsBySkill: { advanced: 2, intermediate: 2, beginner: 1, unknown: 1 },
  wildcardFinish: true,
  speed: "normal",
};

/** Multiplier applied to every animation duration. Lower = faster. */
export const SPEED_MULTIPLIER: Record<CeremonySpeed, number> = {
  relaxed: 1.25,
  normal: 1,
  fast: 0.55,
};

/** How many picks the Wildcard Finish bundles at the very end. */
export const WILDCARD_PICK_COUNT = 3;
