/**
 * Power Slots — surprise slots woven into the draft wheel.
 *
 * Fairness rule: **landing on a power never consumes a team's pick.** When the
 * wheel lands on a power, that team is AWARDED the card, then the wheel
 * auto-re-spins to a real player. Every scheduled turn still yields one player,
 * so the pre-computed size and skill balance is untouched.
 *
 * V1 ships exactly four powers. Landing on one hands the card to the team on the
 * clock; teams hold their cards and play them later:
 *   🎯 First Ball Trial  — a held re-spin the team can use on its own next spin
 *   😂 Meme Drop         — play any time for a cosmetic meme moment
 *   🛡️ Dabur Immunity    — passive shield; blocks an incoming swap (consumed)
 *   🔄 Jo Tera Hai Wo Mera — swap two players with a target team; blocked if the
 *                           target holds Dabur Immunity
 */

import type { UnassignedRegistrationView } from "@/features/squads/types";
import { ALL_POWER_KINDS, POWER_META, type PowerCardId } from "./power-cards";

// Card metadata + the wheel-eligible id list are now DERIVED from the registry
// (see ./power-cards). Re-exported here so existing importers keep working during
// the migration; they will point at ./power-cards directly once callers move over.
export { ALL_POWER_KINDS, POWER_META };

/** A registered power-card id. Kept as a named alias for existing call sites. */
export type PowerKind = PowerCardId;

/** Skill-group key for per-wheel power-slot counts (null level → "unknown"). */
export type SkillKey = "advanced" | "intermediate" | "beginner" | "unknown";

export const SKILL_KEYS: SkillKey[] = ["advanced", "intermediate", "beginner", "unknown"];

export function skillKeyOf(skillLevel: string | null): SkillKey {
  if (skillLevel === "advanced" || skillLevel === "intermediate" || skillLevel === "beginner") {
    return skillLevel;
  }
  return "unknown";
}

/** Default meme pack (custom organizer uploads are a backend follow-up). */
export interface Meme {
  emoji: string;
  caption: string;
}

export const DEFAULT_MEMES: Meme[] = [
  { emoji: "🐐", caption: "GOAT pick incoming" },
  { emoji: "🔥", caption: "This one's on fire" },
  { emoji: "😱", caption: "No wayyy" },
  { emoji: "🍿", caption: "Grab the popcorn" },
  { emoji: "💀", caption: "It's over for the other teams" },
  { emoji: "🤝", caption: "Respect the draft" },
  { emoji: "🚀", caption: "To the moon" },
  { emoji: "🎪", caption: "Welcome to the circus" },
];

export function randomMeme(): Meme {
  return DEFAULT_MEMES[Math.floor(Math.random() * DEFAULT_MEMES.length)]!;
}

export type WheelSlot =
  | { type: "player"; id: string; player: UnassignedRegistrationView }
  | { type: "power"; id: string; power: PowerKind };

export function isPlayerSlot(
  slot: WheelSlot,
): slot is { type: "player"; id: string; player: UnassignedRegistrationView } {
  return slot.type === "player";
}

/**
 * Build the wheel's slot list: all available players plus exactly `powerCount`
 * power slots (organizer-controlled, per skill level), spread out so no two
 * powers sit adjacent. Each power's kind is chosen at random from the four.
 * Returns players-only when the count is 0 or the pool is too small to hide a
 * power in.
 */
export function buildWheelSlots(
  pool: UnassignedRegistrationView[],
  powerCount: number,
): WheelSlot[] {
  const players: WheelSlot[] = pool.map((p) => ({
    type: "player",
    id: p.registrationId,
    player: p,
  }));

  if (powerCount <= 0 || players.length < 2) return players;

  // Never insert more powers than players (keeps the wheel mostly players).
  const count = Math.min(powerCount, players.length);
  const slots: WheelSlot[] = [...players];

  const gap = Math.floor(slots.length / (count + 1)) || 1;
  for (let k = count; k >= 1; k--) {
    const kind = ALL_POWER_KINDS[Math.floor(Math.random() * ALL_POWER_KINDS.length)]!;
    const insertAt = Math.min(slots.length, Math.max(1, gap * k + (k - 1)));
    slots.splice(insertAt, 0, {
      type: "power",
      id: `power-${kind}-${k}-${Math.random().toString(36).slice(2, 6)}`,
      power: kind,
    });
  }
  return slots;
}
