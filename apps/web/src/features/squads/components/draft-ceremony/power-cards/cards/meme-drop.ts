/**
 * 😂 Meme Drop — instant, cosmetic. Played any time; drops a random meme moment.
 * No roster effect. Self-contained: meme content + selection live here.
 */

import { registerPowerCard } from "../registry";
import type { Meme, PowerCard } from "../types";

const DEFAULT_MEMES: Meme[] = [
  { emoji: "🐐", caption: "GOAT pick incoming" },
  { emoji: "🔥", caption: "This one's on fire" },
  { emoji: "😱", caption: "No wayyy" },
  { emoji: "🍿", caption: "Grab the popcorn" },
  { emoji: "💀", caption: "It's over for the other teams" },
  { emoji: "🤝", caption: "Respect the draft" },
  { emoji: "🚀", caption: "To the moon" },
  { emoji: "🎪", caption: "Welcome to the circus" },
];

function randomMeme(): Meme {
  return DEFAULT_MEMES[Math.floor(Math.random() * DEFAULT_MEMES.length)]!;
}

export const memeDrop: PowerCard = {
  id: "meme",
  label: "Meme Drop",
  title: "Meme Drop",
  hint: "Play any time for a cosmetic meme moment",
  emoji: "😂",
  color: "#9db0fb",
  mode: "instant",
  wheelEligible: true,

  canPlay: () => true,

  execute: (ctx) => {
    const squad = ctx.squads.find((s) => s.id === ctx.squadId);
    const meme = randomMeme();
    return {
      events: [
        { type: "CardConsumed", squadId: ctx.squadId, cardId: "meme" },
        {
          type: "CardPlayed",
          squadId: ctx.squadId,
          cardId: "meme",
          detail: `${squad?.name ?? "Team"} played Meme Drop`,
          meme,
        },
      ],
    };
  },
};

registerPowerCard(memeDrop);
