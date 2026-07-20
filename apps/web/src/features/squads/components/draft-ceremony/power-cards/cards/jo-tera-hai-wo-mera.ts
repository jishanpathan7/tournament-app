/**
 * 🔄 Jo Tera Hai Wo Mera — targeted 1-for-1 player swap with another team.
 *
 * Picks the closest-skill non-captain pair (keeps balance barely changed; the
 * 1-for-1 trade keeps sizes identical). BLOCKED if the target holds Dabur
 * Immunity — both cards are then consumed. Behavior is a faithful port of the
 * legacy `swapBetween`; the only forthcoming change (P0) is making the four
 * mutations atomic behind a single port method + a preview/confirm dialog.
 */

import { registerPowerCard } from "../registry";
import type { CardContext, PowerCard } from "../types";
import type { SquadMemberView, SquadView } from "@/features/squads/types";

/** Non-captain members eligible to be swapped. */
function eligible(sq: SquadView): SquadMemberView[] {
  return sq.members.filter((m) => m.registrationId !== sq.captainRegistrationId);
}

/** Closest-skill pair between two teams (min |skillWeight| difference). */
function closestPair(
  from: SquadView,
  to: SquadView,
): { a: SquadMemberView; b: SquadMemberView } | null {
  const fromPlayers = eligible(from);
  const toPlayers = eligible(to);
  if (fromPlayers.length === 0 || toPlayers.length === 0) return null;

  let best: { a: SquadMemberView; b: SquadMemberView; diff: number } | null = null;
  for (const a of fromPlayers) {
    for (const b of toPlayers) {
      const diff = Math.abs(a.skillWeight - b.skillWeight);
      if (!best || diff < best.diff) best = { a, b, diff };
    }
  }
  return best ? { a: best.a, b: best.b } : null;
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

    const pair = closestPair(from, to);
    if (!pair) {
      return { ok: false, summary: "No eligible players to swap", reason: "no-players" };
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
          { type: "ImmunityTriggered", squadId: to.id, toSquad: to.name },
          { type: "SwapBlocked", cardId: "swap", toSquad: to.name, reason: "immunity" },
        ],
      };
    }

    const pair = closestPair(from, to);
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
          aName: pair.a.displayName,
          bName: pair.b.displayName,
          fromSquad: from.name,
          toSquad: to.name,
        },
      ],
    };
  },
};

registerPowerCard(joTeraHaiWoMera);
