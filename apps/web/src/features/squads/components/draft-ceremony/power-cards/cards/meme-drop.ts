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

/**
 * Shuffle bag rather than plain random: draw without replacement and refill when
 * empty, so the eight memes cycle instead of repeating back-to-back. Uniform
 * random reliably produced the same caption twice in a row, which killed the joke
 * in a room that had just seen it.
 */
let bag: Meme[] = [];
let lastDrawn: Meme | null = null;

function refillBag(): void {
  bag = [...DEFAULT_MEMES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j]!, bag[i]!];
  }
  // Avoid a repeat across the refill boundary.
  if (bag.length > 1 && lastDrawn && bag[bag.length - 1] === lastDrawn) {
    [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1]!, bag[0]!];
  }
}

function randomMeme(): Meme {
  if (bag.length === 0) refillBag();
  lastDrawn = bag.pop()!;
  return lastDrawn;
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
