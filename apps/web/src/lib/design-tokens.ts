/**
 * Design token constants for use in TypeScript/Next.js files that can't `require()`
 * the CommonJS preset (e.g. manifest.ts, opengraph-image.tsx, inline styles).
 *
 * Keep in sync with packages/config/design-tokens.js — that file is the canonical
 * source; Tailwind's preset reads it. Changing a value here alone won't affect
 * Tailwind classes.
 */

// ── Primary — Court Cobalt ─────────────────────────────────────────────────
export const PRIMARY       = "#4F6BF6";
export const PRIMARY_DEEP  = "#3A4FD8";
export const PRIMARY_TINT  = "#E5E9FE";
export const PRIMARY_INK   = "#9DB0FB";

// ── Core neutrals ─────────────────────────────────────────────────────────
export const INK           = "#1E293B";
export const INK_2         = "#28324A";
export const INK_BORDER    = "#3A4760";
export const PAPER         = "#FFFDF5";
export const WHITE         = "#FFFFFF";

export const MUTED         = "#F1F5F9";
export const MUTED_FG      = "#475569";
export const FAINT         = "#94A3B8";
export const LINE          = "#E2E8F0";

// ── Status set ────────────────────────────────────────────────────────────
export const MINT          = "#34D399";
export const MINT_DARK     = "#10B981";
export const MINT_TINT     = "#D1FAE5";
export const YELLOW        = "#FBBF24";
export const YELLOW_TINT   = "#FEF3C7";
export const PINK          = "#F472B6";
export const PINK_DARK     = "#DB2777";
export const PINK_TINT     = "#FCE7F3";
