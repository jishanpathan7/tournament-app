import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Vitest — jsdom + React Testing Library. The `@/` alias mirrors tsconfig so tests
 * import exactly like app code. Setup wires jest-dom matchers, `next/*` mocks, and the
 * jsdom polyfills Radix needs. Scope: component / integration / query / permission /
 * loading-state tests (no e2e). `.mts` so ESM-only Vite plugins load cleanly.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: false,
    clearMocks: true,
    restoreMocks: true,
  },
});
