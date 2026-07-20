/**
 * Ceremony session persistence — survives an accidental refresh or tab close
 * mid-draft. Player assignments already live on the server; what is lost on a
 * reload is the *ceremony* state (pre-computed draft order, pick position, card
 * inventory, session history). At a live event that loss is unrecoverable, so we
 * snapshot it to localStorage and restore on mount.
 *
 * Deliberately dumb: one versioned JSON blob per tournament, best-effort. Storage
 * can throw (private mode, quota) — every call is guarded and failure is silent,
 * because a persistence problem must never break the running ceremony.
 */

import type { CeremonySettings } from "@/features/squads/components/draft-ceremony/ceremony-settings";
import type { TeamCards } from "@/features/squads/components/draft-ceremony/power-cards/engine";
import type {
  Assignment,
  CeremonyPhase,
} from "@/features/squads/components/draft-ceremony/use-ceremony";

const VERSION = 1;

function storageKey(tournamentId: string): string {
  return `playlane:ceremony:${tournamentId}`;
}

export interface CeremonySession {
  v: number;
  phase: CeremonyPhase;
  draftOrder: string[];
  totalPicks: number;
  pickIndex: number;
  history: Assignment[];
  teamCards: TeamCards;
  /** Registration ids already assigned this session. */
  assignedIds: string[];
  /** `activeSkill` is `string | null | undefined`; the flag distinguishes unset. */
  activeSkill: string | null;
  activeSkillSet: boolean;
  settings: CeremonySettings;
}

export function saveSession(tournamentId: string, session: CeremonySession): void {
  try {
    window.localStorage.setItem(storageKey(tournamentId), JSON.stringify(session));
  } catch {
    /* storage unavailable — the ceremony continues regardless */
  }
}

/** Load a saved session, or null when absent/unreadable/stale-version. */
export function loadSession(tournamentId: string): CeremonySession | null {
  try {
    const raw = window.localStorage.getItem(storageKey(tournamentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CeremonySession;
    if (parsed.v !== VERSION) return null;
    // Only a ceremony actually in progress is worth restoring.
    if (parsed.phase !== "main" && parsed.phase !== "complete") return null;
    if (!Array.isArray(parsed.draftOrder) || parsed.draftOrder.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession(tournamentId: string): void {
  try {
    window.localStorage.removeItem(storageKey(tournamentId));
  } catch {
    /* ignore */
  }
}

export const SESSION_VERSION = VERSION;
