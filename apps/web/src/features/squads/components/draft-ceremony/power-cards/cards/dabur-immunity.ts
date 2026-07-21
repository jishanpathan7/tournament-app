/**
 * 🛡️ Dabur Immunity — passive shield. Never actively played; it sits in a team's
 * hand and blocks an incoming Jo Tera Hai Wo Mera swap (resolved by that card).
 * `canPlay` is false and `execute` is a no-op — the engine never plays it directly.
 */

import { registerPowerCard } from "../registry";
import type { PowerCard } from "../types";

export const daburImmunity: PowerCard = {
  id: "protection",
  label: "Dabur Immunity",
  title: "Dabur Immunity",
  hint: "Passive shield — blocks an incoming swap",
  emoji: "🛡️",
  color: "#10b981",
  mode: "passive",
  wheelEligible: true,

  canPlay: () => false,

  execute: () => ({ events: [] }),
};

registerPowerCard(daburImmunity);
