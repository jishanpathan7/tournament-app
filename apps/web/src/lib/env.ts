/** Typed access to public runtime env. Add new vars here, never read process.env inline. */
export const env = {
  // 127.0.0.1 (not "localhost") avoids Node resolving to IPv6 ::1 when the API binds IPv4.
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000",
} as const;
