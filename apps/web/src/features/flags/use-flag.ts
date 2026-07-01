"use client";

import { useQuery } from "@tanstack/react-query";
import type { FlagEnabledResponse } from "@tournament/api-client";

import { apiGet } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/**
 * Evaluate a feature flag for the current user (`user > org > global` + rollout, resolved
 * server-side). Gate optional UI on `enabled`. `staleTime` is generous — flags rarely flip.
 */
export function useFlag(key: string, options?: { enabled?: boolean }) {
  const query = useQuery({
    queryKey: queryKeys.flags.enabled(key),
    queryFn: () => apiGet<FlagEnabledResponse>(`/feature-flags/${key}/enabled`),
    staleTime: 5 * 60_000,
    enabled: options?.enabled ?? true,
  });
  return { ...query, isEnabled: query.data?.enabled ?? false };
}
