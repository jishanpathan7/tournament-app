/**
 * Power Cards barrel — the single import that pulls every card module in so they
 * self-register. Importing this file guarantees the registry is populated.
 *
 * Also exposes registry-derived views (`POWER_META`, `ALL_POWER_KINDS`) so legacy
 * consumers keep working during the incremental migration — these are COMPUTED
 * from the registry, never hand-maintained.
 */

// Side-effect imports: each card calls registerPowerCard on load.
// Order here fixes ALL_POWER_KINDS order (kept identical to the legacy array).
import "./cards/first-ball-trial";
import "./cards/meme-drop";
import "./cards/dabur-immunity";
import "./cards/jo-tera-hai-wo-mera";

import { allCards } from "./registry";
import type { PowerCard, PowerCardId } from "./types";

export {
  registerPowerCard,
  getCard,
  findCard,
  allCards,
  wheelEligibleCardIds,
  __resetRegistryForTests,
} from "./registry";
export type {
  PowerCard,
  PowerCardId,
  PlayMode,
  PowerEvent,
  CardContext,
  CardPreview,
  CardResult,
  MutationPort,
  Meme,
} from "./types";

/** Registry-derived metadata map (drop-in for the old hand-kept POWER_META). */
export const POWER_META: Record<PowerCardId, PowerCard> = Object.fromEntries(
  allCards().map((c) => [c.id, c]),
);

/** Registry-derived list of wheel-eligible card ids (drop-in for ALL_POWER_KINDS). */
export const ALL_POWER_KINDS: PowerCardId[] = allCards()
  .filter((c) => c.wheelEligible)
  .map((c) => c.id);
