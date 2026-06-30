/**
 * Candy Sticker theme tokens (see docs/DESIGN-SYSTEM.md §17 / THEME_PORTABLE.md §13B).
 * Shared Tailwind preset — apps extend this and add their own `content` + plugins.
 */
module.exports = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        background: "#FFFDF5",
        foreground: "#1E293B",
        ink: "#1E293B",
        paper: "#FFFDF5",
        candy: { DEFAULT: "#8B5CF6", dark: "#6D28D9", tint: "#EDE9FE" },
        pink: { DEFAULT: "#F472B6", dark: "#DB2777", tint: "#FCE7F3" },
        yellow: { DEFAULT: "#FBBF24", tint: "#FEF3C7" },
        mint: { DEFAULT: "#34D399", dark: "#10B981", tint: "#D1FAE5" },
        line: "#E2E8F0",
        border: "#E2E8F0",
        input: "#E2E8F0",
        ring: "#8B5CF6",
        tick: "#64748B",
        muted: { DEFAULT: "#F1F5F9", foreground: "#475569" },
        card: { DEFAULT: "#FFFFFF", foreground: "#1E293B" },
        primary: { DEFAULT: "#8B5CF6", foreground: "#FFFFFF" },
        secondary: { DEFAULT: "#F472B6", foreground: "#1E293B" },
        accent: { DEFAULT: "#FBBF24", foreground: "#1E293B" },
        destructive: { DEFAULT: "#F472B6", foreground: "#1E293B" },
      },
      borderRadius: {
        sm: "0.375rem",
        md: "0.625rem",
        DEFAULT: "0.75rem",
        lg: "1rem",
        xl: "1.25rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
        blob: "64% 36% 58% 42% / 50% 55% 45% 50%",
        full: "9999px",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Instrument Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Fraunces", "Georgia", "serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      boxShadow: {
        "sticker-xs": "2px 2px 0 0 #1E293B",
        sticker: "4px 4px 0 0 #1E293B",
        "sticker-md": "6px 6px 0 0 #1E293B",
        "sticker-lg": "10px 10px 0 0 #1E293B",
        "sticker-candy": "6px 6px 0 0 #8B5CF6",
        "sticker-pink": "6px 6px 0 0 #F472B6",
        "sticker-yellow": "6px 6px 0 0 #FBBF24",
        "sticker-mint": "6px 6px 0 0 #34D399",
        "pop-focus": "0 0 0 3px #FFFDF5, 0 0 0 5px #8B5CF6",
        dent: "inset 3px 3px 0 0 rgba(30,41,59,0.15)",
      },
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
      },
      animation: {
        "pop-in": "pop-in 200ms cubic-bezier(0.34,1.56,0.64,1)",
        wiggle: "wiggle 300ms ease-in-out",
      },
    },
  },
};
