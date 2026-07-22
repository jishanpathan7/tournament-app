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
import type { PowerCardId } from "@/features/squads/components/draft-ceremony/power-cards/types";

/** Slots a card gets when the organizer has not set a count for it. */
export const DEFAULT_CARD_SLOTS = 1;

/** Counts for one wheel: card id → how many of that card sit on it. */
export type WheelCardSlots = Partial<Record<PowerCardId, number>>;

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
  /**
   * Deck composition **per wheel** — outer key is the skill tier, inner key the
   * card. Tiers hold very different numbers of players (advanced is thin,
   * intermediate is crowded), so one shared count made powers feel commonplace
   * on the small wheel and absent on the big one.
   *
   * Exact counts rather than a total, because a total left the identity of each
   * slot to an independent coin flip: six slots could land four Meri Marzi and no
   * Jo Tera Hai Wo Mera. Asking for two of each now yields exactly two of each.
   *
   * A count of 0 switches the card off on that wheel, so this doubles as the
   * on/off control. Anything unset falls back to 1, so a newly registered card —
   * or a tier the organizer never opened — works without a settings migration.
   */
  cardSlots: Partial<Record<SkillKey, WheelCardSlots>>;
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
  cardSlots: {},
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
