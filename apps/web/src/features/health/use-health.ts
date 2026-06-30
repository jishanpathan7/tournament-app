"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchHealth } from "@/lib/api";

/** Polls the backend health endpoint — the canonical client data-fetching pattern. */
export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 10_000,
    retry: 1,
  });
}
