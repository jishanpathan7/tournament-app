import { create } from "zustand";

/**
 * Match Center keyboard-focus state — which queue row is "focused" for arrow-key
 * navigation + Enter-to-open, independent of the table's own DOM/scroll state. Ephemeral
 * (not persisted): a fresh page load should start with nothing focused.
 */
interface MatchCenterState {
  focusedMatchId: string | null;
  setFocusedMatchId: (id: string | null) => void;
}

export const useMatchCenterStore = create<MatchCenterState>((set) => ({
  focusedMatchId: null,
  setFocusedMatchId: (focusedMatchId) => set({ focusedMatchId }),
}));
