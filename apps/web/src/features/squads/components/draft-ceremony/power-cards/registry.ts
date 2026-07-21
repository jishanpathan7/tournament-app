/**
 * Registry layer — the composition root for the Power Card system.
 *
 * Responsibilities: register, look up, discover. NO business logic, NO React.
 * The engine reaches every card through here (`get`/`all`) and never imports a
 * concrete card module. Cards self-register by importing this and calling
 * `registerPowerCard` (see `power-cards/index.ts`, the barrel that pulls them in).
 */

import type { PowerCard, PowerCardId } from "./types";

const cards = new Map<PowerCardId, PowerCard>();

/** Register a card. Called once per card module at import time. */
export function registerPowerCard(card: PowerCard): void {
  if (cards.has(card.id)) {
    // Duplicate id — last one wins, but surface it in dev.
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(`[power-cards] duplicate registration for "${card.id}"`);
    }
  }
  cards.set(card.id, card);
}

/** Look up a card by id (throws if unknown — an unregistered id is a bug). */
export function getCard(id: PowerCardId): PowerCard {
  const card = cards.get(id);
  if (!card) throw new Error(`[power-cards] no card registered for "${id}"`);
  return card;
}

/** Non-throwing lookup. */
export function findCard(id: PowerCardId): PowerCard | undefined {
  return cards.get(id);
}

/** All registered cards, in registration order. */
export function allCards(): PowerCard[] {
  return [...cards.values()];
}

/** Ids of cards eligible to appear as wheel slots. */
export function wheelEligibleCardIds(): PowerCardId[] {
  return allCards()
    .filter((c) => c.wheelEligible)
    .map((c) => c.id);
}

/** Test-only reset so registration is deterministic across suites. */
export function __resetRegistryForTests(): void {
  cards.clear();
}
