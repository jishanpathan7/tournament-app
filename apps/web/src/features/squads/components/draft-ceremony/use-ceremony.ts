"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { toast } from "@/components/ui/sonner";
import {
  DEFAULT_SETTINGS,
  WILDCARD_PICK_COUNT,
  type CeremonySettings,
  type CeremonySpeed,
} from "@/features/squads/components/draft-ceremony/ceremony-settings";
import type {
  SquadMemberView,
  SquadView,
  UnassignedRegistrationView,
} from "@/features/squads/types";
import { useAssignSquadMember, useSquads } from "@/features/squads/use-squads";
import { errorMessage } from "@/lib/problem";

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
  const squadsQuery = useSquads(tournamentId);
  const assignMutation = useAssignSquadMember(tournamentId);

  const [phase, setPhase] = useState<CeremonyPhase>("intro");
  const [activeSkill, setActiveSkill] = useState<string | null | undefined>(undefined);
  const [history, setHistory] = useState<Assignment[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [pickIndex, setPickIndex] = useState(0);

  // Fun Mode settings — client-side in V1. Off by default (competitive-safe).
  const [settings, setSettings] = useState<CeremonySettings>(DEFAULT_SETTINGS);
  // Squad ids that have spent their one Captain's Shield this ceremony.
  const [shieldsUsed, setShieldsUsed] = useState<Set<string>>(() => new Set());
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

  const pool = allUnassigned.filter(
    (u) => !assignedIds.current.has(u.registrationId) && u.skillLevel === resolvedSkill,
  );

  const totalRemaining = allUnassigned.filter(
    (u) => !assignedIds.current.has(u.registrationId),
  ).length;

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

  // Captain's Shield availability for the team currently on the clock.
  const canUseShield =
    settings.funMode &&
    settings.captainShield &&
    !!currentSquadId &&
    !shieldsUsed.has(currentSquadId);

  const useShield = useCallback((squadId: string) => {
    setShieldsUsed((prev) => {
      if (prev.has(squadId)) return prev;
      const next = new Set(prev);
      next.add(squadId);
      return next;
    });
  }, []);

  const clearJustCompleted = useCallback(() => setJustCompletedSquadId(null), []);

  const updateSettings = useCallback((patch: Partial<CeremonySettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const setSpeed = useCallback((speed: CeremonySpeed) => {
    setSettings((prev) => ({ ...prev, speed }));
  }, []);

  function start() {
    // Compute the full draft order once, seeded with current squad state.
    const totalPoolWeight = allUnassigned.reduce((sum, u) => sum + u.skillWeight, 0);
    draftOrderRef.current = computeDraftOrder(squads, allUnassigned.length, totalPoolWeight);
    totalPicksRef.current = draftOrderRef.current.length;
    setPickIndex(0);
    setShieldsUsed(new Set());
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

  const undo = useCallback(() => {
    const last = history[history.length - 1];
    if (!last) return;

    assignedIds.current = new Set(
      [...assignedIds.current].filter((id) => id !== last.registrationId),
    );
    setHistory((h) => h.slice(0, -1));
    // Step back in the pre-computed sequence — order never changes.
    setPickIndex((p) => Math.max(0, p - 1));
    setJustCompletedSquadId(null);
    if (phase === "complete") setPhase("main");
    squadsQuery.refetch();
  }, [history, phase, squadsQuery]);

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
    canUseShield,
    useShield,
    shieldsUsed,
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
