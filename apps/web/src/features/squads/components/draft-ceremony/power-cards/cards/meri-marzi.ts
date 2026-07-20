/**
 * 🫵 Meri Marzi — skip the spin and pick a player yourself.
 *
 * Fairness: the team still receives exactly one player, from the same skill
 * tier the wheel was already drawing from. Only *which* name changes, never how
 * many — so team sizes and the pre-computed order are untouched.
 *
 * The card declares that it needs a player chosen from the pool; the ceremony
 * renders that picker generically and commits the pick through the same path a
 * spin uses. The card itself just spends and announces.
 */

import { registerPowerCard } from "../registry";
import type { PowerCard } from "../types";

export const meriMarzi: PowerCard = {
  id: "choose",
  label: "Meri Marzi",
  title: "Meri Marzi!",
  hint: "Skip the spin — choose any player on this wheel yourself",
  emoji: "🫵",
  color: "#fbbf24",
  mode: "self",
  wheelEligible: true,
  selection: { from: "pool", prompt: "Choose your pick" },

  canPlay: (ctx) => (ctx.teamCards[ctx.squadId] ?? []).includes("choose"),

  execute: (ctx) => {
    const squad = ctx.squads.find((s) => s.id === ctx.squadId);
    return {
      events: [
        { type: "CardConsumed", squadId: ctx.squadId, cardId: "choose" },
        {
          type: "CardPlayed",
          squadId: ctx.squadId,
          cardId: "choose",
          detail: `${squad?.name ?? "Team"} picked their own player`,
        },
      ],
    };
  },
};

registerPowerCard(meriMarzi);
