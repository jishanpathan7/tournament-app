"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { PublicTournamentView } from "@tournament/api-client";
import { createContext, useContext } from "react";

import { publicQueryKeys } from "@/features/public/query-keys";
import { usePublicTournament } from "@/features/public/use-public-tournament";
import { usePublicRealtime } from "@/hooks/use-public-realtime";
import { REALTIME_EVENTS } from "@/lib/realtime";

interface PublicTournamentContextValue {
  tournament: PublicTournamentView;
  slug: string;
}

const PublicTournamentContext = createContext<PublicTournamentContextValue | null>(null);

/**
 * Wraps every page under `(public)/t/[slug]`: seeds the tournament query from the
 * server-fetched `initialTournament` (SSR for SEO + fast first paint), opens the one
 * realtime subscription for the whole tournament visit, and hands the resolved
 * tournament down via context so child pages don't each re-fetch it. Realtime
 * invalidation is coarse (invalidate the whole matches/standings list rather than
 * one row) — public traffic patterns don't warrant finer-grained cache surgery.
 */
export function PublicTournamentProvider({
  slug,
  initialTournament,
  children,
}: {
  slug: string;
  initialTournament: PublicTournamentView;
  children: React.ReactNode;
}) {
  const tournament = usePublicTournament(slug, initialTournament);
  const queryClient = useQueryClient();

  usePublicRealtime(tournament.data?.id ?? null, {
    [REALTIME_EVENTS.MATCH_COMPLETED]: (data) => {
      void queryClient.invalidateQueries({ queryKey: publicQueryKeys.matches(slug) });
      if (typeof data.matchId === "string") {
        void queryClient.invalidateQueries({
          queryKey: publicQueryKeys.match(slug, data.matchId),
        });
        void queryClient.invalidateQueries({
          queryKey: publicQueryKeys.matchEvents(slug, data.matchId),
        });
      }
    },
    [REALTIME_EVENTS.BRACKET_UPDATED]: () => {
      void queryClient.invalidateQueries({ queryKey: publicQueryKeys.matches(slug) });
    },
    [REALTIME_EVENTS.STANDINGS_UPDATED]: () => {
      // Stage-scoped standings keys aren't known here; sweep every standings query
      // for this tournament (cheap — there's at most a handful of stages).
      void queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "public" &&
          query.queryKey[1] === "tournament" &&
          query.queryKey[2] === slug &&
          query.queryKey[4] === "standings",
      });
    },
  });

  return (
    <PublicTournamentContext.Provider value={{ tournament: tournament.data ?? initialTournament, slug }}>
      {children}
    </PublicTournamentContext.Provider>
  );
}

export function usePublicTournamentContext(): PublicTournamentContextValue {
  const ctx = useContext(PublicTournamentContext);
  if (!ctx) {
    throw new Error("usePublicTournamentContext must be used within PublicTournamentProvider");
  }
  return ctx;
}
