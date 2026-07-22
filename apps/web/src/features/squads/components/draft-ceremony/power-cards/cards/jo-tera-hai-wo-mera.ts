/**
 * 🔄 Jo Tera Hai Wo Mera — targeted 1-for-1 player swap with another team.
 *
 * The raiding captain chooses BOTH players, and the two must share a skill
 * level. That is stricter than the old behaviour, which auto-picked the
 * closest-skill pair and would happily trade advanced for intermediate when
 * nothing nearer existed. Requiring an exact match means a swap leaves both
 * teams' skill totals mathematically unchanged, so card play can never erode
 * the balance the draft worked to produce.
 *
 * Captains are never swappable — they are the team's identity on screen.
 * BLOCKED if the target holds Dabur Immunity; both cards are then consumed.
 * When no same-skill pair exists the raid is blocked and the card is NOT
 * consumed, so the captain can go after a different team.
 */

import { registerPowerCard } from "../registry";
import type { CardContext, PowerCard } from "../types";
import type { SquadMemberView, SquadView } from "@/features/squads/types";

/** Non-captain members eligible to be swapped. */
function eligible(sq: SquadView): SquadMemberView[] {
  return sq.members.filter((m) => m.registrationId !== sq.captainRegistrationId);
}

/**
 * Skill bucket a player trades within. Players with no recorded level form
 * their own group rather than acting as wildcards — otherwise "unspecified"
 * would be a back door to the advanced-for-beginner trade the rule forbids.
 */
export function skillBucket(member: SquadMemberView): string {
  return member.skillLevel ?? "__unspecified__";
}

export function sameSkill(a: SquadMemberView, b: SquadMemberView): boolean {
  return skillBucket(a) === skillBucket(b);
}

/**
 * Every legal trade between two teams: non-captains on both sides, matched on
 * skill. Drives the picker's list and the "is this raid possible at all" check.
 */
export function legalSwaps(
  from: SquadView,
  to: SquadView,
): { a: SquadMemberView; b: SquadMemberView }[] {
  const out: { a: SquadMemberView; b: SquadMemberView }[] = [];
  for (const a of eligible(from)) {
    for (const b of eligible(to)) {
      if (sameSkill(a, b)) out.push({ a, b });
    }
  }
  return out;
}

/**
 * The pair to act on: the captain's choice when they made one, otherwise the
 * first legal pair as a suggestion so a one-click confirm still works. A choice
 * that breaks the rules is rejected rather than silently corrected — a captain
 * must never be told a swap happened that isn't the one they picked.
 */
function resolvePair(
  from: SquadView,
  to: SquadView,
  chosen: CardContext["chosenSwap"],
): { a: SquadMemberView; b: SquadMemberView } | null {
  const legal = legalSwaps(from, to);
  if (!chosen) return legal[0] ?? null;
  return (
    legal.find(
      (p) =>
        p.a.registrationId === chosen.fromRegistrationId &&
        p.b.registrationId === chosen.toRegistrationId,
    ) ?? null
  );
}

function resolveTeams(ctx: CardContext) {
  const from = ctx.squads.find((s) => s.id === ctx.squadId);
  const to = ctx.targetSquadId ? ctx.squads.find((s) => s.id === ctx.targetSquadId) : undefined;
  return { from, to };
}

export const joTeraHaiWoMera: PowerCard = {
  id: "swap",
  label: "Jo Tera Hai Wo Mera",
  title: "Jo Tera Hai Wo Mera!",
  hint: "Swap players with a team — blocked by their Dabur Immunity",
  emoji: "🔄",
  color: "#db2777",
  mode: "targeted",
  wheelEligible: true,

  canPlay: (ctx) => (ctx.teamCards[ctx.squadId] ?? []).includes("swap"),

  preview: (ctx) => {
    const { from, to } = resolveTeams(ctx);
    if (!from || !to) return { ok: false, summary: "Pick a team to raid", reason: "no-target" };

    if ((ctx.teamCards[to.id] ?? []).includes("protection")) {
      return {
        ok: false,
        summary: `🛡️ Blocked by ${to.name}'s Dabur Immunity`,
        reason: "immunity",
      };
    }

    const pair = resolvePair(from, to, ctx.chosenSwap);
    if (!pair) {
      const summary = ctx.chosenSwap
        ? "Those two are not the same skill level"
        : `No same-skill players to trade with ${to.name}`;
      return { ok: false, summary, reason: "no-players" };
    }
    return {
      ok: true,
      summary: `${pair.a.displayName}  ⇄  ${pair.b.displayName}`,
      swap: { a: pair.a, b: pair.b, fromSquad: from.name, toSquad: to.name },
    };
  },

  execute: async (ctx) => {
    const { from, to } = resolveTeams(ctx);
    if (!from || !to) return { events: [] };

    // Dabur Immunity on the target blocks the swap — both cards cancel out.
    if ((ctx.teamCards[to.id] ?? []).includes("protection")) {
      return {
        events: [
          { type: "CardConsumed", squadId: from.id, cardId: "swap" },
          { type: "CardConsumed", squadId: to.id, cardId: "protection" },
          { type: "ImmunityTriggered", squadId: to.id, toSquad: to.name, cardId: "protection" },
          { type: "SwapBlocked", cardId: "swap", toSquad: to.name, reason: "immunity" },
        ],
      };
    }

    const pair = resolvePair(from, to, ctx.chosenSwap);
    if (!pair) {
      // No eligible players — the swap card is NOT consumed (re-playable).
      return {
        events: [{ type: "SwapBlocked", cardId: "swap", toSquad: to.name, reason: "no-players" }],
      };
    }

    // Single atomic trade — both players move or neither does. Replaces the old
    // four-call remove/remove/assign/assign sequence that could half-fail.
    await ctx.port.swap(
      { squadId: from.id, registrationId: pair.a.registrationId },
      { squadId: to.id, registrationId: pair.b.registrationId },
    );

    return {
      events: [
        { type: "CardConsumed", squadId: from.id, cardId: "swap" },
        {
          type: "SwapCompleted",
          cardId: "swap",
          a: { squadId: from.id, registrationId: pair.a.registrationId },
          b: { squadId: to.id, registrationId: pair.b.registrationId },
          aName: pair.a.displayName,
          bName: pair.b.displayName,
          fromSquad: from.name,
          toSquad: to.name,
        },
      ],
    };
  },

  /**
   * Reverse a completed swap: trade the same two players back through the same
   * atomic endpoint, and hand the swap card back to the team that spent it —
   * an undone play should cost nothing. Captains disputing a swap is the
   * scenario this exists for.
   */
  undo: async (ctx) => {
    const e = ctx.event;
    if (e.type !== "SwapCompleted") return { events: [] };

    // The players now sit on the opposite squads, so swap them back.
    await ctx.port.swap(
      { squadId: e.b.squadId, registrationId: e.a.registrationId },
      { squadId: e.a.squadId, registrationId: e.b.registrationId },
    );

    return {
      events: [
        { type: "CardAwarded", squadId: e.a.squadId, squadName: e.fromSquad, cardId: "swap" },
        {
          type: "SwapCompleted",
          cardId: "swap",
          a: { squadId: e.b.squadId, registrationId: e.a.registrationId },
          b: { squadId: e.a.squadId, registrationId: e.b.registrationId },
          aName: e.aName,
          bName: e.bName,
          fromSquad: e.toSquad,
          toSquad: e.fromSquad,
        },
      ],
    };
  },
};

registerPowerCard(joTeraHaiWoMera);
