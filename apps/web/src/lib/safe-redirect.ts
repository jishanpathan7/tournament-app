/**
 * Validates a redirect destination from an untrusted source (e.g. `?next=` query param).
 *
 * Accepts only same-origin relative paths (must start with a single `/` and not `//`).
 * Rejects anything that could be exploited for open redirects:
 *   - Absolute URLs (https://evil.com)
 *   - Protocol-relative URLs (//evil.com)
 *   - Backslash tricks (\evil.com)
 *   - Embedded credentials (@)
 *   - Non-string / empty values
 *
 * Returns the validated path, or `fallback` when the input is unsafe.
 */
export function safeRedirectPath(next: string | null | undefined, fallback = "/console"): string {
  if (
    !next ||
    typeof next !== "string" ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\") ||
    next.includes("@")
  ) {
    return fallback;
  }
  return next;
}
