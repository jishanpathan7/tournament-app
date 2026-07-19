/**
 * 🎯 First Ball Trial — a held re-spin the team plays on its OWN next spin.
 * Playing it consumes the card and signals a re-spin; the wheel re-spin itself
 * is a presentation action taken in response to the CardPlayed event (the engine
 * stays UI-free — it does not spin anything).
 */

import { registerPowerCard } from "../registry";
import type { PowerCard } from "../types";

export const firstBallTrial: PowerCard = {
  id: "respin",
  label: "First Ball Trial",
  title: "First Ball Trial",
  hint: "A held re-spin the team can use on its own next spin",
  emoji: "🎯",
  color: "#4f6bf6",
  mode: "self",
  wheelEligible: true,

  /** Playable only by the team on the clock (enforced again in presentation). */
  canPlay: (ctx) => (ctx.teamCards[ctx.squadId] ?? []).includes("respin"),

  execute: (ctx) => {
    const squad = ctx.squads.find((s) => s.id === ctx.squadId);
    return {
      events: [
        { type: "CardConsumed", squadId: ctx.squadId, cardId: "respin" },
        {
          type: "CardPlayed",
          squadId: ctx.squadId,
          cardId: "respin",
          detail: `${squad?.name ?? "Team"} used First Ball Trial — re-spinning`,
        },
      ],
    };
  },
};

registerPowerCard(firstBallTrial);
