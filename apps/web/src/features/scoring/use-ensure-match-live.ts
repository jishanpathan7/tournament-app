"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import * as scoringApi from "@/features/scoring/scoring-api";
import { reconcileMatchInCaches } from "@/lib/live-tournament-cache";

/**
 * Transition scheduled → live when scoring begins. Idempotent — safe to call on every
 * first point / first score input; no-ops once live or terminal.
 */
export function useEnsureMatchLive(
  matchId: string,
  tournamentId: string,
  matchStatus: string,
  stageId?: string,
) {
  const queryClient = useQueryClient();
  const statusRef = useRef(matchStatus);
  const startedRef = useRef(matchStatus === "live");

  useEffect(() => {
    statusRef.current = matchStatus;
    if (matchStatus === "live") startedRef.current = true;
  }, [matchStatus]);

  const start = useMutation({
    mutationFn: (ifMatch?: string | null) => scoringApi.startMatch(matchId, { ifMatch }),
    onSuccess: (match) => {
      startedRef.current = true;
      statusRef.current = "live";
      reconcileMatchInCaches(queryClient, match, tournamentId, "started");
    },
  });

  const ensureLive = useCallback(
    async (ifMatch?: string | null) => {
      const status = statusRef.current;
      if (startedRef.current || status === "live") return;
      if (status !== "scheduled") return;
      startedRef.current = true;
      try {
        await start.mutateAsync(ifMatch);
      } catch (err) {
        startedRef.current = false;
        throw err;
      }
    },
    [start],
  );

  return { ensureLive, isStarting: start.isPending };
}
