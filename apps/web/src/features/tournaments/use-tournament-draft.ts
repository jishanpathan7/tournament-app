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
/** Division entrant shape at tournament creation — excludes franchise ``squad`` competitors. */
export type DivisionParticipantKind = Exclude<ParticipantKind, "squad">;

export interface DraftDivision {
  name: string;
  participantType: DivisionParticipantKind;
}

export type EventTypePreset = "singles" | "doubles" | "both";

export interface TournamentDraft {
  name: string;
  slug: string;
  visibility: Visibility;
  sportKey: string;
  format: StageFormat;
  startsAt: string;
  endsAt: string;
  eventType: EventTypePreset;
  divisions: DraftDivision[];
}

export function divisionsFromEventType(eventType: EventTypePreset): DraftDivision[] {
  switch (eventType) {
    case "singles":
      return [{ name: "Singles", participantType: "individual" }];
    case "doubles":
      return [{ name: "Doubles", participantType: "individual" }];
    case "both":
      return [
        { name: "Singles", participantType: "individual" },
        { name: "Doubles", participantType: "individual" },
      ];
  }
}

const EMPTY_DRAFT: TournamentDraft = {
  name: "",
  slug: "",
  visibility: "private",
  sportKey: "badminton",
  format: "round_robin",
  startsAt: "",
  endsAt: "",
  eventType: "doubles",
  divisions: divisionsFromEventType("doubles"),
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
