"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchSession } from "@/features/auth/auth-api";
import { queryKeys } from "@/lib/query-keys";

/**
 * The current session (`GET /auth/me`) — `null` when signed out. This is the app's
 * canonical auth source; components read it anywhere, cache is shared. `activeRole`
 * drives UI permission gating (see `useCan`).
 */
export function useSession() {
  const query = useQuery({
    queryKey: queryKeys.session,
    queryFn: fetchSession,
    staleTime: 60_000,
    retry: false,
  });

  return {
    ...query,
    session: query.data ?? null,
    isAuthenticated: !!query.data,
  };
}
