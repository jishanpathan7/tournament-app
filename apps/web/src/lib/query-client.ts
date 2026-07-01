import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/problem";

/**
 * QueryClient factory (one per browser session, created in Providers). Sensible
 * defaults for a tenant app: 30s freshness, no window-focus refetch, and a retry
 * policy that never retries 4xx (auth/permission/validation are deterministic) but
 * does retry transient network/5xx a couple times.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiError) {
            if (error.isNetwork) return failureCount < 2;
            if (error.status >= 400 && error.status < 500) return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}
