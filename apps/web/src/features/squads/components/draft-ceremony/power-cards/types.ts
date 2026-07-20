/**
 * Power Card framework — shared types (registry + engine + presentation).
 *
 * Three layers, one-way imports: presentation → engine → registry → card modules.
 * This file is the only thing all three share. It imports NO React and NO concrete
 * card. Keep it plain data + function signatures.
 */

import type { SquadMemberView, SquadView } from "@/features/squads/types";

/** How a card is played once a team holds it. */
export type PlayMode =
  /** Never actively played; its effect is resolved by another card (Dabur Immunity). */
  | "passive"
  /** Played on the owner's own turn (First Ball Trial re-spin). */
  | "self"
  /** Played any time, no target needed. */
  | "instant"
  /** Played onto another team (Jo Tera Hai Wo Mera swap). */
  | "targeted";

/** Card ids are plain strings, discovered from the registry (no hand-kept union). */
export type PowerCardId = string;

/**
 * The one interface every card implements. A card module exports a single object
 * of this shape and registers it. The engine only ever sees this interface — it
 * never learns which concrete cards exist.
 */
export interface PowerCard {
  id: PowerCardId;
  /** Short label shown on the wheel slot + inventory chip. */
  label: string;
  /** Title shown in the resolve overlay / confirm dialog. */
  title: string;
  /** One-line explanation for the settings panel + tooltips. */
  hint: string;
  emoji: string;
  /** Slot/chip fill color (design-token hex). */
  color: string;
  mode: PlayMode;
  /** Whether this card can appear as a wheel slot. */
  wheelEligible: boolean;
  /**
   * Optional: this card needs a player chosen before it resolves. The ceremony
   * renders the picker from this descriptor, so a new card needing a choice
   * costs no new UI.
   */
  selection?: { from: "pool"; prompt: string };

  /** Availability/validation for the current context. */
  canPlay(ctx: CardContext): boolean;
  /** Optional pre-execution preview (drives the confirm dialog). */
  preview?(ctx: CardContext): CardPreview;
  /** Perform the card's effect. Returns the outcome + the events to emit. */
  execute(ctx: CardContext): Promise<CardResult> | CardResult;
  /**
   * Optional: reverse a completed play. Opt-in — a card that cannot be undone
   * simply omits this, and the UI offers no undo for it. Keeps the engine and
   * the timeline closed for modification when new cards arrive.
   */
  undo?(ctx: UndoContext): Promise<CardResult> | CardResult;
}

/** Context for reversing a play — the original event carries what to undo. */
export interface UndoContext extends CardContext {
  event: PowerEvent;
}

/**
 * Everything a card needs to decide/preview/execute, with zero UI or React.
 * `targetSquadId` is set only for `targeted` plays. Mutations go through the
 * injected `port` (never a direct hook import), so the engine + cards are
 * unit-testable without React.
 */
export interface CardContext {
  cardId: PowerCardId;
  /** The team holding/playing the card. */
  squadId: string;
  /** Target team for a `targeted` play. */
  targetSquadId?: string;
  /** Live board snapshot (plain data). */
  squads: SquadView[];
  /** Cards each team currently holds. */
  teamCards: Record<string, PowerCardId[]>;
  /** Side-effecting roster mutations (injected — real one wraps React Query). */
  port: MutationPort;
}

/** Result of a `preview()` — plain data the dialog renders. */
export interface CardPreview {
  /** Whether the play is currently possible (else `reason` explains why not). */
  ok: boolean;
  /** Human-readable one-liner, e.g. "Aman ⇄ Rahul". */
  summary: string;
  reason?: string;
  /** Structured swap detail when applicable (lets the dialog show both sides). */
  swap?: { a: SquadMemberView; b: SquadMemberView; fromSquad: string; toSquad: string };
}

/** Result of `execute()` — the outcome plus the domain events to emit. */
export interface CardResult {
  events: PowerEvent[];
}

/** One side of an atomic swap. */
export interface SwapSide {
  squadId: string;
  registrationId: string;
}

/**
 * Roster mutation port — the only way a card touches the server. The real
 * implementation wraps the squad mutations; tests pass a fake. Kept to exactly
 * what the shipped cards need; add methods when a card actually requires one.
 */
export interface MutationPort {
  /**
   * Atomically trade one member between two squads — both move or neither does.
   * Backed by a single transactional endpoint, so a mid-flight failure can never
   * leave a player unassigned.
   */
  swap(a: SwapSide, b: SwapSide): Promise<void>;
}

// ── Domain events (engine → presentation) ──────────────────────────────────────
// The engine emits these; presentation animates / timelines / overlays / toasts.
// Payloads are plain data only — never React nodes.

export type PowerEvent =
  | { type: "CardAwarded"; squadId: string; squadName: string; cardId: PowerCardId }
  | { type: "CardConsumed"; squadId: string; cardId: PowerCardId }
  | { type: "CardPreviewRequested"; cardId: PowerCardId; preview: CardPreview }
  | { type: "CardPlayed"; squadId: string; cardId: PowerCardId; detail: string }
  | {
      type: "SwapCompleted";
      cardId: PowerCardId;
      /** Ids are carried so the swap can be reversed without re-deriving it. */
      a: SwapSide;
      b: SwapSide;
      aName: string;
      bName: string;
      fromSquad: string;
      toSquad: string;
    }
  | { type: "SwapBlocked"; cardId: PowerCardId; toSquad: string; reason: "immunity" | "no-players" }
  /** `cardId` is the BLOCKING card, so the UI can name it without hardcoding it. */
  | { type: "ImmunityTriggered"; squadId: string; toSquad: string; cardId: PowerCardId };
