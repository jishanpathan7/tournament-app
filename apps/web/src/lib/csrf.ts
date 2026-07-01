/**
 * CSRF double-submit helper. The API sets a JS-readable `csrf_token` cookie; every
 * mutating request must echo it in an `X-CSRF-Token` header (see docs/API-CONVENTIONS.md).
 * Read it fresh per request — it rotates on refresh/login.
 */
export const CSRF_COOKIE = "csrf_token";
export const CSRF_HEADER = "X-CSRF-Token";

export function readCsrfToken(): string | null {
  if (typeof document === "undefined") return null; // SSR: no cookie jar
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

const MUTATING = new Set(["post", "put", "patch", "delete"]);

export function isMutating(method: string | undefined): boolean {
  return MUTATING.has((method ?? "get").toLowerCase());
}
