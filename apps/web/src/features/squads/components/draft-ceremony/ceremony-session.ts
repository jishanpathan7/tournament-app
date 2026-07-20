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
import { findCard } from "@/features/squads/components/draft-ceremony/power-cards";
import type { TeamCards } from "@/features/squads/components/draft-ceremony/power-cards/engine";
import type {
  ActivityEntry,
  Assignment,
  CeremonyPhase,
} from "@/features/squads/components/draft-ceremony/use-ceremony";

const VERSION = 2;

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
  /** Cards each team has already played, kept so the rail can show them spent. */
  spentCards: TeamCards;
  /** Power-moment timeline, so the audit trail survives a refresh too. */
  activity: ActivityEntry[];
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
    // Tolerate a blob written before a field existed rather than dropping the
    // whole session — losing a ceremony mid-event is the worse failure.
    // A card can be retired between sessions. Drop ids the registry no longer
    // knows, or restoring would crash on the first lookup of a deleted card.
    const keepKnown = (cards: TeamCards | undefined): TeamCards =>
      Object.fromEntries(
        Object.entries(cards ?? {}).map(([squadId, ids]) => [
          squadId,
          ids.filter((id) => findCard(id) !== undefined),
        ]),
      );

    return {
      ...parsed,
      teamCards: keepKnown(parsed.teamCards),
      spentCards: keepKnown(parsed.spentCards),
      activity: (parsed.activity ?? []).filter(
        (a) => !("cardId" in a.event) || findCard(a.event.cardId) !== undefined,
      ),
    };
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
