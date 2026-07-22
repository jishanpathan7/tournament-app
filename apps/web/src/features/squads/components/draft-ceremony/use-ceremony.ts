"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { toast } from "@/components/ui/sonner";
import {
  clearSession,
  loadSession,
  saveSession,
  SESSION_VERSION,
} from "@/features/squads/components/draft-ceremony/ceremony-session";
import {
  DEFAULT_SETTINGS,
  WILDCARD_PICK_COUNT,
  type CeremonySettings,
  type CeremonySpeed,
} from "@/features/squads/components/draft-ceremony/ceremony-settings";
import {
  awardCardEvent,
  canPlay as engineCanPlay,
  isUndoable,
  playCard as enginePlay,
  previewCard as enginePreview,
  reduceTeamCards,
  undoCard as engineUndo,
  type TeamCards,
} from "@/features/squads/components/draft-ceremony/power-cards/engine";
import type {
  CardContext,
  CardPreview,
  MutationPort,
  PowerCardId,
  PowerEvent,
} from "@/features/squads/components/draft-ceremony/power-cards/types";
import type {
  SquadMemberView,
  SquadView,
  UnassignedRegistrationView,
} from "@/features/squads/types";
import {
  useAssignSquadMember,
  useRemoveSquadMember,
  useSquads,
  useSwapSquadMembers,
} from "@/features/squads/use-squads";
import { errorMessage } from "@/lib/problem";

/** One power moment in the ceremony's activity timeline. */
export interface ActivityEntry {
  id: string;
  /** The domain event, kept whole so an undo can reverse exactly what happened. */
  event: PowerEvent;
  /** Set once this entry has been reversed, so it cannot be undone twice. */
  undone?: boolean;
}

/** "intros" only appears when Fun Mode + team introductions are enabled. */
export type CeremonyPhase = "intro" | "intros" | "main" | "complete";

export interface Assignment {
  registrationId: string;
  displayName: string;
  squadId: string;
  squadName: string;
  skillLevel: string | null;
  skillWeight: number;
  pickNumber: number;
}

const SKILL_ORDER = ["advanced", "intermediate", "beginner"] as const;

export function uniqueSkillGroups(entries: UnassignedRegistrationView[]): (string | null)[] {
  const present = new Set(entries.map((e) => e.skillLevel));
  const ordered: (string | null)[] = SKILL_ORDER.filter((s) => present.has(s));
  if (present.has(null)) ordered.push(null);
  return ordered;
}

export function skillLabel(s: string | null): string {
  if (!s) return "No level";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Pre-compute the full draft pick sequence before the ceremony begins.
 *
 * Algorithm:
 *   Seed each team's skill weight with its captain(s) weight, then greedily
 *   assign each of the N pick slots to the team that, at that moment, has:
 *     1. Fewest draft picks assigned so far  (size balance — guarantees ±1)
 *     2. Lowest cumulative skill weight       (skill balance tiebreak)
 *     3. Lowest sort order                   (stable tiebreak)
 *
 *   After each simulated pick we add `expectedGain = totalPoolWeight / N`
 *   (the average skill per player in the pool) to the winning team's weight.
 *   This lets the sequence anticipate future assignments even though actual
 *   player skill is decided randomly by the wheel.
 *
 * Returns an ordered array of squad IDs — one entry per pick slot.
 * The ceremony plays through this array in order; it never changes mid-run.
 */
export function computeDraftOrder(
  squads: SquadView[],
  totalPlayers: number,
  totalPoolWeight: number,
): string[] {
  if (squads.length === 0 || totalPlayers === 0) return [];

  const expectedGain = totalPoolWeight / totalPlayers;

  // Mutable state for the simulation — keyed by squad id.
  const draftPicks = new Map<string, number>(squads.map((s) => [s.id, 0]));
  const skillWeight = new Map<string, number>(squads.map((s) => [s.id, s.totalSkillWeight]));

  const order: string[] = [];

  for (let i = 0; i < totalPlayers; i++) {
    // Pick the team that needs the next slot most.
    let best: SquadView | null = null;
    for (const squad of squads) {
      if (!best) {
        best = squad;
        continue;
      }
      const picks = draftPicks.get(squad.id)!;
      const bestPicks = draftPicks.get(best.id)!;
      if (picks !== bestPicks) {
        if (picks < bestPicks) best = squad;
        continue;
      }
      const weight = skillWeight.get(squad.id)!;
      const bestWeight = skillWeight.get(best.id)!;
      if (weight !== bestWeight) {
        if (weight < bestWeight) best = squad;
        continue;
      }
      if (squad.sortOrder < best.sortOrder) best = squad;
    }

    const winner = best!;
    order.push(winner.id);
    draftPicks.set(winner.id, draftPicks.get(winner.id)! + 1);
    skillWeight.set(winner.id, skillWeight.get(winner.id)! + expectedGain);
  }

  return order;
}

export function useCeremony(tournamentId: string) {
  // alwaysFresh: the ceremony is projected full-screen, frequently in a different
  // tab from the Teams page — team renames must show the moment we regain focus.
  const squadsQuery = useSquads(tournamentId, { alwaysFresh: true });
  const assignMutation = useAssignSquadMember(tournamentId);
  const removeMutation = useRemoveSquadMember(tournamentId);
  const swapMutation = useSwapSquadMembers(tournamentId);

  const [phase, setPhase] = useState<CeremonyPhase>("intro");
  const [activeSkill, setActiveSkill] = useState<string | null | undefined>(undefined);
  const [history, setHistory] = useState<Assignment[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [pickIndex, setPickIndex] = useState(0);

  // Fun Mode settings — client-side in V1. Off by default (competitive-safe).
  const [settings, setSettings] = useState<CeremonySettings>(DEFAULT_SETTINGS);
  // Power cards each team is holding — awarded when the wheel lands on a power
  // slot, played later. Keyed by squad id. Mutated only via engine reducers.
  const [teamCards, setTeamCards] = useState<TeamCards>({});
  // Cards already played, per team. Purely a record for the UI — a spent card is
  // shown greyed out rather than vanishing, so the room can see what was used.
  const [spentCards, setSpentCards] = useState<TeamCards>({});
  // Append-only record of every power moment, newest last. Drives the activity
  // timeline and is what makes a swap auditable (and reversible) in the room.
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  // Squad that just received its final player — drives the completion celebration.
  const [justCompletedSquadId, setJustCompletedSquadId] = useState<string | null>(null);

  // Pre-computed draft order — set once when ceremony starts, never mutated.
  const draftOrderRef = useRef<string[]>([]);
  // Total picks the ceremony will make — fixed once started (drives wildcard).
  const totalPicksRef = useRef<number>(0);

  const board = squadsQuery.data;
  const allUnassigned = board?.unassigned ?? [];
  const squads = useMemo(() => board?.squads ?? [], [board]);

  // Resolve each squad's captain member (for intros + shield attribution).
  const captainBySquad = useMemo(() => {
    const map = new Map<string, SquadMemberView | null>();
    for (const squad of squads) {
      const captain = squad.captainRegistrationId
        ? (squad.members.find((m) => m.registrationId === squad.captainRegistrationId) ?? null)
        : null;
      map.set(squad.id, captain);
    }
    return map;
  }, [squads]);

  const skillGroups = uniqueSkillGroups(allUnassigned);
  const resolvedSkill = activeSkill === undefined ? (skillGroups[0] ?? null) : activeSkill;

  const assignedIds = useRef<Set<string>>(new Set());

  // ── Refresh resilience ────────────────────────────────────────────────────
  // Assignments live on the server, but the ceremony's own state (draft order,
  // pick position, card inventory, session history) is client-only — losing it
  // mid-event is unrecoverable. Snapshot it and restore on mount.
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const saved = loadSession(tournamentId);
    if (!saved) return;

    draftOrderRef.current = saved.draftOrder;
    totalPicksRef.current = saved.totalPicks;
    assignedIds.current = new Set(saved.assignedIds);
    setPickIndex(saved.pickIndex);
    setHistory(saved.history);
    setTeamCards(saved.teamCards);
    setSpentCards(saved.spentCards);
    setActivity(saved.activity);
    setSettings(saved.settings);
    setActiveSkill(saved.activeSkillSet ? saved.activeSkill : undefined);
    setPhase(saved.phase);
    toast.success("Ceremony session restored");
  }, [tournamentId]);

  // Snapshot whenever the persisted slice changes (skipped before the draft runs).
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (phase !== "main" && phase !== "complete") return;
    saveSession(tournamentId, {
      v: SESSION_VERSION,
      phase,
      draftOrder: draftOrderRef.current,
      totalPicks: totalPicksRef.current,
      pickIndex,
      history,
      teamCards,
      spentCards,
      activity,
      assignedIds: [...assignedIds.current],
      activeSkill: activeSkill ?? null,
      activeSkillSet: activeSkill !== undefined,
      settings,
    });
  }, [
    tournamentId,
    phase,
    pickIndex,
    history,
    teamCards,
    spentCards,
    activity,
    activeSkill,
    settings,
  ]);

  // Last-resort guard: warn before an accidental reload/close mid-draft.
  useEffect(() => {
    if (phase !== "main") return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [phase]);

  const pool = allUnassigned.filter(
    (u) => !assignedIds.current.has(u.registrationId) && u.skillLevel === resolvedSkill,
  );

  const totalRemaining = allUnassigned.filter(
    (u) => !assignedIds.current.has(u.registrationId),
  ).length;

  // Roll on to the next skill tier once the current one is drafted out.
  //
  // The tier used to be sticky: after picking a tab it never moved, and the tab
  // strip hides itself once a single group is left — so finishing Advanced and
  // Intermediate stranded the organizer on an empty wheel with the remaining
  // Beginners unreachable. The ceremony should flow tier to tier by itself.
  useEffect(() => {
    if (phase !== "main") return;
    if (pool.length > 0 || totalRemaining === 0) return;

    const nextGroup = skillGroups.find((group) =>
      allUnassigned.some(
        (u) => !assignedIds.current.has(u.registrationId) && u.skillLevel === group,
      ),
    );
    if (nextGroup !== undefined && nextGroup !== resolvedSkill) setActiveSkill(nextGroup);
    // Arrays are rebuilt each render; the counts are the meaningful triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pool.length, totalRemaining, resolvedSkill]);

  // Resolve the current squad from the pre-computed sequence.
  const currentSquadId = draftOrderRef.current[pickIndex] ?? null;
  const currentSquad: SquadView | undefined = squads.find((s) => s.id === currentSquadId);

  // Wildcard Finish: the final N picks are bundled into one simultaneous reveal.
  const totalPicks = totalPicksRef.current;
  const isWildcardActive =
    settings.funMode &&
    settings.wildcardFinish &&
    totalPicks > WILDCARD_PICK_COUNT &&
    pickIndex >= totalPicks - WILDCARD_PICK_COUNT;

  // Power slots appear while Fun Mode + power slots are on (count per skill wheel
  // is set by the organizer in settings.powerSlotsBySkill).
  const powersEnabled = settings.funMode && settings.powerSlots;

  // ── Power-card engine adapter ─────────────────────────────────────────────
  // The hook owns the inventory STATE + wires the engine's MutationPort to the
  // real React Query mutations. All card rules live in the engine/cards; this
  // layer only holds state and forwards. Roster mutations flow through `port`.
  const port: MutationPort = useMemo(
    () => ({
      swap: async (a, b) => {
        await swapMutation.mutateAsync({
          squadAId: a.squadId,
          registrationAId: a.registrationId,
          squadBId: b.squadId,
          registrationBId: b.registrationId,
        });
      },
    }),
    [swapMutation],
  );

  const buildContext = useCallback(
    (cardId: PowerCardId, squadId: string, targetSquadId?: string): CardContext => ({
      cardId,
      squadId,
      targetSquadId,
      squads,
      teamCards,
      port,
    }),
    [squads, teamCards, port],
  );

  /** Record the events worth showing in the timeline (state moves are noise). */
  const logEvents = useCallback((events: PowerEvent[]) => {
    const shown = events.filter((e) => e.type !== "CardConsumed" && e.type !== "ImmunityTriggered");
    if (shown.length === 0) return;
    setActivity((prev) => [
      ...prev,
      ...shown.map((event, i) => ({
        id: `${Date.now()}-${prev.length + i}-${Math.random().toString(36).slice(2, 7)}`,
        event,
      })),
    ]);
  }, []);

  /** Hand a power card to a team (on wheel landing). Returns the emitted events. */
  const awardCard = useCallback(
    (squadId: string, cardId: PowerCardId): PowerEvent[] => {
      const squad = squads.find((s) => s.id === squadId);
      const events: PowerEvent[] = [awardCardEvent(squadId, squad?.name ?? "", cardId)];
      setTeamCards((prev) => reduceTeamCards(prev, events));
      logEvents(events);
      return events;
    },
    [squads, logEvents],
  );

  /** Whether a card can be played right now (delegates to the engine/card). */
  const canPlayCard = useCallback(
    (cardId: PowerCardId, squadId: string, targetSquadId?: string): boolean =>
      engineCanPlay(cardId, buildContext(cardId, squadId, targetSquadId)),
    [buildContext],
  );

  /** Preview a play without mutating (drives the confirm dialog). */
  const previewCard = useCallback(
    (cardId: PowerCardId, squadId: string, targetSquadId?: string): CardPreview | null =>
      enginePreview(cardId, buildContext(cardId, squadId, targetSquadId)),
    [buildContext],
  );

  /**
   * Play a card through the engine: execute → fold events onto inventory → return
   * events for the presentation layer to animate. Refetches the board when a swap
   * moved players so the roster stays in sync.
   */
  const playCard = useCallback(
    async (cardId: PowerCardId, squadId: string, targetSquadId?: string): Promise<PowerEvent[]> => {
      const { events } = await enginePlay(cardId, buildContext(cardId, squadId, targetSquadId));
      setTeamCards((prev) => reduceTeamCards(prev, events));
      // Mirror every consumption into the spent log so the rail can show it.
      setSpentCards((prev) => {
        let next = prev;
        for (const e of events) {
          if (e.type !== "CardConsumed") continue;
          next = { ...next, [e.squadId]: [...(next[e.squadId] ?? []), e.cardId] };
        }
        return next;
      });
      if (events.some((e) => e.type === "SwapCompleted")) {
        void squadsQuery.refetch();
      }
      logEvents(events);
      return events;
    },
    [buildContext, squadsQuery, logEvents],
  );

  /** The most recent play that is still reversible, if any. */
  const undoableEntry = useMemo(() => {
    for (let i = activity.length - 1; i >= 0; i--) {
      const entry = activity[i]!;
      if (entry.undone) continue;
      const cardId = "cardId" in entry.event ? entry.event.cardId : null;
      // Only a completed effect is reversible — an award is not a "play".
      if (!cardId || entry.event.type !== "SwapCompleted") continue;
      return isUndoable(cardId) ? entry : null;
    }
    return null;
  }, [activity]);

  /**
   * Reverse the most recent reversible play. The card decides what "reverse"
   * means; this only routes and applies the resulting events. Exists so a
   * disputed swap can be walked back live instead of standing as final.
   */
  const undoLastPlay = useCallback(async (): Promise<PowerEvent[]> => {
    const entry = undoableEntry;
    if (!entry || !("cardId" in entry.event)) return [];
    const cardId = entry.event.cardId;
    const squadId = entry.event.type === "SwapCompleted" ? entry.event.a.squadId : "";

    const { events } = await engineUndo(cardId, {
      ...buildContext(cardId, squadId),
      event: entry.event,
    });
    if (events.length === 0) return [];

    setTeamCards((prev) => reduceTeamCards(prev, events));
    // Returning the card also un-spends it, or the rail would show it twice.
    setSpentCards((prev) => {
      let next = prev;
      for (const e of events) {
        if (e.type !== "CardAwarded") continue;
        const hand = next[e.squadId] ?? [];
        const i = hand.indexOf(e.cardId);
        if (i === -1) continue;
        next = { ...next, [e.squadId]: [...hand.slice(0, i), ...hand.slice(i + 1)] };
      }
      return next;
    });
    setActivity((prev) => prev.map((a) => (a.id === entry.id ? { ...a, undone: true } : a)));
    void squadsQuery.refetch();
    return events;
  }, [undoableEntry, buildContext, squadsQuery]);

  const clearJustCompleted = useCallback(() => setJustCompletedSquadId(null), []);

  const updateSettings = useCallback((patch: Partial<CeremonySettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const setSpeed = useCallback((speed: CeremonySpeed) => {
    setSettings((prev) => ({ ...prev, speed }));
  }, []);

  function start() {
    // A fresh ceremony supersedes any restored one.
    clearSession(tournamentId);
    assignedIds.current = new Set();
    setHistory([]);
    // Compute the full draft order once, seeded with current squad state.
    const totalPoolWeight = allUnassigned.reduce((sum, u) => sum + u.skillWeight, 0);
    draftOrderRef.current = computeDraftOrder(squads, allUnassigned.length, totalPoolWeight);
    totalPicksRef.current = draftOrderRef.current.length;
    setPickIndex(0);
    setTeamCards({});
    setSpentCards({});
    setActivity([]);
    // Fun Mode with intros enabled runs the team walk-in first.
    setPhase(settings.funMode && settings.teamIntroductions ? "intros" : "main");
  }

  /** Advance from the team-introductions walk-in into the main draft. */
  const beginDraft = useCallback(() => setPhase("main"), []);

  async function assign(
    player: UnassignedRegistrationView,
    squadId?: string,
  ): Promise<Assignment | null> {
    const targetId = squadId ?? currentSquadId;
    const targetSquad = squads.find((s) => s.id === targetId);
    if (!targetId || !targetSquad) return null;

    setIsAssigning(true);
    try {
      await assignMutation
        .mutateAsync({ squadId: targetId, registrationId: player.registrationId })
        .catch((e) => {
          toast.error(errorMessage(e, "Couldn't assign player"));
          throw e;
        });

      assignedIds.current = new Set([...assignedIds.current, player.registrationId]);

      const record: Assignment = {
        registrationId: player.registrationId,
        displayName: player.displayName,
        squadId: targetId,
        squadName: targetSquad.name,
        skillLevel: player.skillLevel,
        skillWeight: player.skillWeight,
        pickNumber: history.length + 1,
      };
      setHistory((h) => [...h, record]);
      setPickIndex((p) => p + 1);

      // Team completion: does this team have any picks left in the sequence?
      const nextIndex = pickIndex + 1;
      const teamHasMorePicks = draftOrderRef.current.slice(nextIndex).some((id) => id === targetId);
      if (!teamHasMorePicks && targetSquad.name) {
        setJustCompletedSquadId(targetId);
      }

      const remaining = allUnassigned.filter(
        (u) => !assignedIds.current.has(u.registrationId),
      ).length;
      if (remaining === 0) setPhase("complete");

      return record;
    } finally {
      setIsAssigning(false);
    }
  }

  /**
   * Take back the most recent pick — on the SERVER as well as locally.
   *
   * Rolling back only local state left the player assigned in the squad, so they
   * never returned to the pool and the pick could not actually be redone. Both
   * "Undo last pick" and a First Ball Trial re-roll depend on this.
   *
   * Returns the reverted assignment so the caller can re-spin for that team.
   */
  const unassignLast = useCallback(async (): Promise<Assignment | null> => {
    const last = history[history.length - 1];
    if (!last) return null;

    try {
      await removeMutation.mutateAsync({
        squadId: last.squadId,
        registrationId: last.registrationId,
      });
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't take back that pick"));
      return null;
    }

    assignedIds.current = new Set(
      [...assignedIds.current].filter((id) => id !== last.registrationId),
    );
    setHistory((h) => h.slice(0, -1));
    // Step back in the pre-computed sequence — order never changes.
    setPickIndex((p) => Math.max(0, p - 1));
    setJustCompletedSquadId(null);
    if (phase === "complete") setPhase("main");
    await squadsQuery.refetch();
    return last;
  }, [history, phase, squadsQuery, removeMutation]);

  const undo = useCallback(() => {
    void unassignLast();
  }, [unassignLast]);

  function changeSkill(skill: string | null) {
    setActiveSkill(skill);
  }

  // Upcoming picks visible to the UI (next 3 after current).
  const upcomingSquadIds = draftOrderRef.current.slice(pickIndex + 1, pickIndex + 4);
  const upcomingSquads = upcomingSquadIds
    .map((id) => squads.find((s) => s.id === id))
    .filter((s): s is SquadView => s !== undefined);

  return {
    phase,
    squads,
    pool,
    skillGroups,
    resolvedSkill,
    totalRemaining,
    history,
    isAssigning,
    currentSquad,
    pickIndex,
    upcomingSquads,
    // Fun Mode
    settings,
    updateSettings,
    setSpeed,
    captainBySquad,
    powersEnabled,
    teamCards,
    spentCards,
    activity,
    undoableEntry,
    undoLastPlay,
    unassignLast,
    awardCard,
    canPlayCard,
    previewCard,
    playCard,
    isWildcardActive,
    justCompletedSquadId,
    clearJustCompleted,
    start,
    beginDraft,
    assign,
    undo,
    changeSkill,
    isLoading: squadsQuery.isLoading,
    isError: squadsQuery.isError,
  };
}
