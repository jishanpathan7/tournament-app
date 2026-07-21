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
 *   🛡️ Dabur Immunity    — passive shield; blocks an incoming swap (consumed)
 *   🔄 Jo Tera Hai Wo Mera — swap two players with a target team; blocked if the
 *                           target holds Dabur Immunity
 */

import type { UnassignedRegistrationView } from "@/features/squads/types";
import { ALL_POWER_KINDS, type PowerCardId } from "./power-cards";

// The wheel-eligible id list is DERIVED from the registry (see ./power-cards).
// Re-exported here for buildWheelSlots' callers; card metadata is read directly
// from the registry via getCard.
export { ALL_POWER_KINDS };

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

export type WheelSlot =
  | { type: "player"; id: string; player: UnassignedRegistrationView }
  | { type: "power"; id: string; power: PowerKind };

export function isPlayerSlot(
  slot: WheelSlot,
): slot is { type: "player"; id: string; player: UnassignedRegistrationView } {
  return slot.type === "player";
}

/**
 * Build the wheel's slot list: every player, plus exactly the cards in `deck`,
 * spread out so no two cards sit adjacent.
 *
 * The deck carries each card as many times as the organizer asked for, so the
 * composition is exact. Card identity used to be drawn independently per slot,
 * which meant six slots could land four of one card and none of another.
 *
 * Returns players-only when the deck is empty or the pool is too small to hide a
 * card in.
 */
export function buildWheelSlots(
  pool: UnassignedRegistrationView[],
  deck: PowerCardId[],
): WheelSlot[] {
  const players: WheelSlot[] = pool.map((p) => ({
    type: "player",
    id: p.registrationId,
    player: p,
  }));

  if (deck.length === 0 || players.length < 2) return players;

  // Never place more cards than players — keeps the wheel mostly names.
  // Shuffle so position on the wheel does not give the card away.
  const cards = shuffle(deck).slice(0, players.length);
  const slots: WheelSlot[] = [...players];

  const gap = Math.floor(slots.length / (cards.length + 1)) || 1;
  for (let k = cards.length; k >= 1; k--) {
    const kind = cards[k - 1]!;
    const insertAt = Math.min(slots.length, Math.max(1, gap * k + (k - 1)));
    slots.splice(insertAt, 0, {
      type: "power",
      id: `power-${kind}-${k}-${Math.random().toString(36).slice(2, 6)}`,
      power: kind,
    });
  }
  return slots;
}

/** Fisher-Yates, on a copy. */
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
