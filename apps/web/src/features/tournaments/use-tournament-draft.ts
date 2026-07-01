"use client";

import type { ParticipantKind, StageFormat, Visibility } from "@tournament/api-client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Create-tournament wizard draft. Persisted to localStorage so a half-filled form
 * survives navigation/reload ("draft saving"). Steps read initial values from here and
 * commit on Next; `reset()` runs after a successful create. Distinct from the API — this
 * is unsubmitted local state, hence Zustand rather than TanStack Query.
 */
export interface DraftDivision {
  name: string;
  participantType: ParticipantKind;
}

export interface TournamentDraft {
  name: string;
  slug: string;
  visibility: Visibility;
  sportKey: string;
  format: StageFormat;
  startsAt: string;
  endsAt: string;
  divisions: DraftDivision[];
}

const EMPTY_DRAFT: TournamentDraft = {
  name: "",
  slug: "",
  visibility: "private",
  sportKey: "badminton",
  format: "round_robin",
  startsAt: "",
  endsAt: "",
  divisions: [{ name: "Main Draw", participantType: "individual" }],
};

interface DraftStore {
  step: number;
  draft: TournamentDraft;
  setStep: (step: number) => void;
  patch: (partial: Partial<TournamentDraft>) => void;
  reset: () => void;
}

export const useTournamentDraft = create<DraftStore>()(
  persist(
    (set) => ({
      step: 0,
      draft: EMPTY_DRAFT,
      setStep: (step) => set({ step }),
      patch: (partial) => set((s) => ({ draft: { ...s.draft, ...partial } })),
      reset: () => set({ step: 0, draft: EMPTY_DRAFT }),
    }),
    { name: "tp.tournament-draft" },
  ),
);

/** Derive a URL-safe slug from a name (client-side hint; server validates). */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
