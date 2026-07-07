/**
 * Candy Sticker — Court Cobalt edition (SETMATCH build).
 * Shared Tailwind preset — apps extend this and add their own `content` + plugins.
 *
 * All hex constants live in design-tokens.js; edit there to retheme.
 * See docs/DESIGN-SYSTEM.md §17 / SETMATCH_THEME.md for spec.
 */
const T = require("./design-tokens");

module.exports = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        // ── Semantic aliases (consumed by shadcn base) ──────────────────
        background: T.PAPER,
        foreground: T.INK,
        border: T.LINE,
        input: T.LINE,
        ring: T.PRIMARY,
        card: { DEFAULT: T.WHITE, foreground: T.INK },
        muted: { DEFAULT: T.MUTED, foreground: T.MUTED_FG },
        primary: { DEFAULT: T.PRIMARY, foreground: T.WHITE },
        secondary: { DEFAULT: T.PINK, foreground: T.INK },
        accent: { DEFAULT: T.YELLOW, foreground: T.INK },
        destructive: { DEFAULT: T.PINK, foreground: T.INK },

        // ── Neutral palette ────────────────────────────────────────────
        paper: T.PAPER,
        ink: T.INK,
        "ink-2": T.INK_2, // raised panels on dark surfaces
        "ink-border": T.INK_BORDER, // borders inside dark surfaces
        faint: T.FAINT, // tertiary / meta text
        tick: T.MUTED_2, // placeholder text (= muted-2 in spec)
        line: T.LINE,

        // ── Primary — Court Cobalt ────────────────────────────────────
        candy: {
          DEFAULT: T.PRIMARY,
          dark: T.PRIMARY_DEEP,
          tint: T.PRIMARY_TINT,
          ink: T.PRIMARY_INK, // primary on dark surfaces
        },

        // ── Status set (fixed) ────────────────────────────────────────
        mint: { DEFAULT: T.MINT, dark: T.MINT_DARK, tint: T.MINT_TINT },
        yellow: { DEFAULT: T.YELLOW, tint: T.YELLOW_TINT },
        pink: { DEFAULT: T.PINK, dark: T.PINK_DARK, tint: T.PINK_TINT },
      },

      // ── Border radius (sticker-generous, §3) ───────────────────────────
      borderRadius: {
        sm: "0.375rem", // 6px
        md: "0.625rem", // 10px — inputs, small tiles
        DEFAULT: "0.75rem", // 12px
        lg: "1rem", // 16px
        xl: "1.25rem", // 20px — cards/panels min
        "2xl": "1.5rem", // 24px — cards/panels default
        "3xl": "2rem", // 32px
        blob: "64% 36% 58% 42% / 50% 55% 45% 50%",
        full: "9999px", // pills, buttons, badges
      },

      // ── Typography (§2) ───────────────────────────────────────────────
      fontFamily: {
        sans: ["var(--font-sans)", "Instrument Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Fraunces", "Georgia", "serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }], // mono eyebrow
        "3xs": ["0.5625rem", { lineHeight: "0.875rem" }], // mono micro-label
      },

      // ── Hard-offset shadows — NEVER blurred (§3) ─────────────────────
      boxShadow: {
        // ── Ink (neutral) sticker shadows
        "sticker-xs": `2px 2px 0 0 ${T.INK}`,
        sticker: `4px 4px 0 0 ${T.INK}`,
        "sticker-md": `6px 6px 0 0 ${T.INK}`,
        "sticker-lg": `10px 10px 0 0 ${T.INK}`,

        // ── Primary (candy / cobalt) — used by the candy button (§5)
        // Resting / hover / active shadow uses cobalt-DEEP to create depth
        "sticker-candy": `4px 4px 0 0 ${T.PRIMARY_DEEP}`,
        "sticker-candy-md": `6px 6px 0 0 ${T.PRIMARY_DEEP}`,
        "sticker-candy-xs": `2px 2px 0 0 ${T.PRIMARY_DEEP}`,

        // ── Decorative cobalt accent (bracket boards, option-card selected, etc.)
        "sticker-cobalt": `6px 6px 0 0 ${T.PRIMARY}`,

        // ── Status accent shadows
        "sticker-pink": `6px 6px 0 0 ${T.PINK}`,
        "sticker-yellow": `6px 6px 0 0 ${T.YELLOW}`,
        "sticker-mint": `6px 6px 0 0 ${T.MINT}`,

        // ── Utility
        "pop-focus": `0 0 0 3px ${T.PAPER}, 0 0 0 5px ${T.PRIMARY}`,
        dent: `inset 3px 3px 0 0 rgba(30,41,59,0.15)`,
      },

      // ── Motion (§4) — springy, brief, physical ────────────────────────
      transitionTimingFunction: {
        bouncy: "cubic-bezier(0.34,1.56,0.64,1)",
        candy: "cubic-bezier(0.22,1,0.36,1)",
      },
      keyframes: {
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(.88) translateY(6px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        wiggle: {
          "0%,100%": { transform: "rotate(-4deg)" },
          "50%": { transform: "rotate(4deg)" },
        },
        // Live indicator pulse — 7–9px circle in mint
        livepulse: {
          "0%,100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(0.55)", opacity: "0.4" },
        },
        // Gentle float (decorative elements, hero graphics)
        floaty: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-7px)" },
        },
      },
      animation: {
        "pop-in": "pop-in 200ms cubic-bezier(0.34,1.56,0.64,1)",
        wiggle: "wiggle 300ms ease-in-out",
        "live-pulse": "livepulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
        floaty: "floaty 3s ease-in-out infinite",
      },
    },
  },
};
