import type { Config } from "tailwindcss";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const preset = require("@tournament/config/tailwind-preset");

const config: Config = {
  presets: [preset],
  content: ["./src/**/*.{ts,tsx}", "../../packages/shared/src/**/*.{ts,tsx}"],
  plugins: [],
};

export default config;
