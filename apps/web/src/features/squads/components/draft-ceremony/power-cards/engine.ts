/**
 * Engine layer — orchestrates card execution. Game rules only, ZERO UI/React.
 *
 * The engine is generic: it reaches every card through the registry (`getCard`)
 * and never imports a concrete card module, so it does not know which concrete
 * cards exist — only that a card implements the
 * standard interface. Its outputs are a `CardResult` (events) plus pure reducers
 * over the `teamCards` inventory; it never writes React state. Fully unit-testable
 * without React (see engine.test.ts).
 */

import { getCard } from "./registry";
import type {
  CardContext,
  CardPreview,
  CardResult,
  PowerCardId,
  PowerEvent,
  UndoContext,
} from "./types";

/** A team's held-card inventory, keyed by squad id. */
export type TeamCards = Record<string, PowerCardId[]>;

// ── Pure inventory reducers ─────────────────────────────────────────────────────

function award(tc: TeamCards, squadId: string, cardId: PowerCardId): TeamCards {
  return { ...tc, [squadId]: [...(tc[squadId] ?? []), cardId] };
}

function consume(tc: TeamCards, squadId: string, cardId: PowerCardId): TeamCards {
  const hand = tc[squadId] ?? [];
  const i = hand.indexOf(cardId);
  if (i === -1) return tc;
  return { ...tc, [squadId]: [...hand.slice(0, i), ...hand.slice(i + 1)] };
}

/**
 * Fold a batch of events onto the inventory. Only CardAwarded / CardConsumed move
 * inventory; everything else is presentation-only. Returns a new object.
 */
export function reduceTeamCards(tc: TeamCards, events: PowerEvent[]): TeamCards {
  let next = tc;
  for (const e of events) {
    if (e.type === "CardAwarded") next = award(next, e.squadId, e.cardId);
    else if (e.type === "CardConsumed") next = consume(next, e.squadId, e.cardId);
  }
  return next;
}

// ── Orchestration ───────────────────────────────────────────────────────────────

/** Build the CardAwarded event for a wheel landing (award is an engine rule). */
export function awardCardEvent(
  squadId: string,
  squadName: string,
  cardId: PowerCardId,
): PowerEvent {
  return { type: "CardAwarded", squadId, squadName, cardId };
}

/** Whether the card can currently be played in this context. */
export function canPlay(cardId: PowerCardId, ctx: CardContext): boolean {
  return getCard(cardId).canPlay(ctx);
}

/** Preview a play without mutating (null when the card offers no preview). */
export function previewCard(cardId: PowerCardId, ctx: CardContext): CardPreview | null {
  const card = getCard(cardId);
  return card.preview ? card.preview(ctx) : null;
}

/**
 * Play a card: validate → execute → return its events. The caller folds the
 * events onto inventory via `reduceTeamCards` and dispatches them to the UI. A
 * card that fails `canPlay` is a no-op (empty events).
 */
export async function playCard(cardId: PowerCardId, ctx: CardContext): Promise<CardResult> {
  const card = getCard(cardId);
  if (!card.canPlay(ctx)) return { events: [] };
  return await card.execute(ctx);
}

/** Whether this card opted into being reversible. */
export function isUndoable(cardId: PowerCardId): boolean {
  return typeof getCard(cardId).undo === "function";
}

/** Reverse a completed play. No-op for cards that did not implement `undo`. */
export async function undoCard(cardId: PowerCardId, ctx: UndoContext): Promise<CardResult> {
  const card = getCard(cardId);
  if (!card.undo) return { events: [] };
  return await card.undo(ctx);
}
