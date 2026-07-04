/**
 * Candy Sticker — Court Cobalt edition (SETMATCH build).
 *
 * Single source of truth for every design token.
 * - tailwind-preset.js requires this file (CommonJS)
 * - apps/web/src/lib/design-tokens.ts re-exports these values for TypeScript callers
 *   (manifest.ts, opengraph-image.tsx, etc.)
 *
 * To retune the primary color for a different brand, change the PRIMARY_* constants
 * only. Everything else propagates automatically.
 */

// ── Primary — Court Cobalt ──────────────────────────────────────────────────
const PRIMARY          = "#4F6BF6";  // primary buttons, active nav, focus, key accents
const PRIMARY_DEEP     = "#3A4FD8";  // primary button shadow + pressed text
const PRIMARY_TINT     = "#E5E9FE";  // tinted card backgrounds, active nav background
const PRIMARY_INK      = "#9DB0FB";  // primary used ON dark surfaces (labels, text)

// ── Core neutrals ──────────────────────────────────────────────────────────
const INK              = "#1E293B";  // all borders, primary text, dark surfaces
const INK_2            = "#28324A";  // raised panels inside dark surfaces
const INK_BORDER       = "#3A4760";  // borders inside dark surfaces
const PAPER            = "#FFFDF5";  // app background (warm cream)
const WHITE            = "#FFFFFF";  // default card fill

const MUTED            = "#F1F5F9";  // inset chips, muted backgrounds
const MUTED_FG         = "#475569";  // secondary text
const MUTED_2          = "#64748B";  // placeholder text
const FAINT            = "#94A3B8";  // tertiary / meta text
const LINE             = "#E2E8F0";  // hairline dividers, inactive borders

// ── Status set (fixed — never change without product decision) ─────────────
const MINT             = "#34D399";  // live / active / won / qualified
const MINT_DARK        = "#10B981";  // pulsing dot, text on mint tint
const MINT_TINT        = "#D1FAE5";

const YELLOW           = "#FBBF24";  // upcoming / warning / turnover / needs-attention
const YELLOW_TINT      = "#FEF3C7";

const PINK             = "#F472B6";  // eliminated / conflict / danger / review
const PINK_DARK        = "#DB2777";
const PINK_TINT        = "#FCE7F3";

module.exports = {
  PRIMARY, PRIMARY_DEEP, PRIMARY_TINT, PRIMARY_INK,
  INK, INK_2, INK_BORDER, PAPER, WHITE,
  MUTED, MUTED_FG, MUTED_2, FAINT, LINE,
  MINT, MINT_DARK, MINT_TINT,
  YELLOW, YELLOW_TINT,
  PINK, PINK_DARK, PINK_TINT,
};
