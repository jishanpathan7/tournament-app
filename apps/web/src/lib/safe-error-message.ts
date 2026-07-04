/**
 * Maps HTTP status codes to safe, user-facing error messages for anonymous/public
 * fetch clients that use raw `fetch()` rather than the authenticated axios instance.
 *
 * Never expose raw backend response bodies or axios internals in public pages — they
 * can contain internal path info, stack traces, or verbose validation details.
 */
export function safeErrorMessage(status: number): string {
  if (status === 400) return "The request was invalid. Please check your input.";
  if (status === 401) return "Authentication required.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "Not found.";
  if (status === 409) return "A conflict occurred. The resource may have changed.";
  if (status === 422) return "The submitted data was invalid.";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status >= 500) return "A server error occurred. Please try again later.";
  return "An unexpected error occurred. Please try again.";
}
