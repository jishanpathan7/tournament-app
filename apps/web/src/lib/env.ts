/** Typed access to public runtime env. Add new vars here, never read process.env inline. */
const internalUrl = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";

function resolveApiUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_API_URL;
  if (explicit !== undefined && explicit !== "") {
    return explicit;
  }
  // Browser: same-origin /api/v1 (proxied to the backend in next.config.mjs).
  if (typeof window !== "undefined") {
    return "";
  }
  // RSC / SSR: reach the API directly (no cross-site cookie issue server-side).
  return internalUrl;
}

export const env = {
  apiUrl: resolveApiUrl(),
  /** Public origin of this app (e.g. https://playlane.app). Used for OG metadata,
   *  share links, and tournament registration URLs. Set NEXT_PUBLIC_APP_URL in Vercel. */
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  /** Sentry DSN for browser-side error reporting. Leave empty in dev/CI to disable. */
  sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? "",
} as const;
