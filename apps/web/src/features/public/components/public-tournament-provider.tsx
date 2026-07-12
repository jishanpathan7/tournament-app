"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { PublicTournamentView } from "@tournament/api-client";
import { createContext, useContext } from "react";

import { invalidatePublicLiveCaches } from "@/features/public/public-live-cache";
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
 * tournament down via context so child pages don't each re-fetch it.
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

  usePublicRealtime(slug, {
    [REALTIME_EVENTS.MATCH_STARTED]: (data) => {
      invalidatePublicLiveCaches(queryClient, slug, {
        matchId: typeof data.matchId === "string" ? data.matchId : undefined,
      });
    },
    [REALTIME_EVENTS.MATCH_COMPLETED]: (data) => {
      invalidatePublicLiveCaches(queryClient, slug, {
        matchId: typeof data.matchId === "string" ? data.matchId : undefined,
        standings: true,
      });
    },
    [REALTIME_EVENTS.BRACKET_UPDATED]: () => {
      invalidatePublicLiveCaches(queryClient, slug);
    },
    [REALTIME_EVENTS.STANDINGS_UPDATED]: () => {
      invalidatePublicLiveCaches(queryClient, slug, { standings: true, courts: false });
    },
    [REALTIME_EVENTS.SCHEDULE_UPDATED]: (data) => {
      invalidatePublicLiveCaches(queryClient, slug, {
        matchId: typeof data.matchId === "string" ? data.matchId : undefined,
      });
    },
  });

  return (
    <PublicTournamentContext.Provider
      value={{ tournament: tournament.data ?? initialTournament, slug }}
    >
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
