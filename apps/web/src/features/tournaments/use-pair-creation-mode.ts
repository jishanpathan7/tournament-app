"use client";

import { useTournament } from "@/features/tournaments/use-tournaments";

export type PairCreationMode = "auto" | "manual";

export function usePairCreationMode(tournamentId: string): {
  mode: PairCreationMode;
  isAuto: boolean;
  isManual: boolean;
} {
  const { data: tournament } = useTournament(tournamentId);
  const raw = (tournament?.settings as Record<string, unknown> | undefined)?.["pair_creation_mode"];
  const mode: PairCreationMode = raw === "manual" ? "manual" : "auto";
  return { mode, isAuto: mode === "auto", isManual: mode === "manual" };
}
