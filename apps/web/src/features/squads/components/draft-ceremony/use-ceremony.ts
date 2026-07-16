"use client";

import { useCallback, useRef, useState } from "react";

import { toast } from "@/components/ui/sonner";
import type { SquadView, UnassignedRegistrationView } from "@/features/squads/types";
import { useAssignSquadMember, useSquads } from "@/features/squads/use-squads";
import { errorMessage } from "@/lib/problem";

export type CeremonyPhase = "intro" | "main" | "complete";

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
 * Pick the squad that should receive the next drafted player.
 *
 * Priority:
 *   1. Fewest total players (size balance — never exceed ±1 across teams)
 *   2. Lowest total skill weight (skill balance tiebreak)
 *   3. Lowest sort order (stable tiebreak when weights are equal)
 *
 * `squadState` maps squad id → { playerCount, skillWeight } reflecting the
 * current state including players already drafted this session.
 */
export function pickTargetSquad(
  squads: SquadView[],
  squadState: Map<string, { playerCount: number; skillWeight: number }>,
): SquadView | undefined {
  if (squads.length === 0) return undefined;
  return squads.reduce((best, squad) => {
    const b = squadState.get(best.id) ?? {
      playerCount: best.memberCount,
      skillWeight: best.totalSkillWeight,
    };
    const s = squadState.get(squad.id) ?? {
      playerCount: squad.memberCount,
      skillWeight: squad.totalSkillWeight,
    };
    if (s.playerCount !== b.playerCount) return s.playerCount < b.playerCount ? squad : best;
    if (s.skillWeight !== b.skillWeight) return s.skillWeight < b.skillWeight ? squad : best;
    return squad.sortOrder < best.sortOrder ? squad : best;
  });
}

export function useCeremony(tournamentId: string) {
  const squadsQuery = useSquads(tournamentId);
  const assignMutation = useAssignSquadMember(tournamentId);

  const [phase, setPhase] = useState<CeremonyPhase>("intro");
  const [activeSkill, setActiveSkill] = useState<string | null | undefined>(undefined);
  const [history, setHistory] = useState<Assignment[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);

  // Running skill-weight and player-count state per squad, built from history.
  // Initialised lazily from squads data so captains' weights are included.
  const squadStateRef = useRef<Map<string, { playerCount: number; skillWeight: number }>>(
    new Map(),
  );

  const board = squadsQuery.data;
  const allUnassigned = board?.unassigned ?? [];
  const squads = board?.squads ?? [];

  // Initialise squadState from server data whenever squads load/reload,
  // but only when there is no in-flight history (avoids clobbering mid-session).
  if (squads.length > 0 && squadStateRef.current.size === 0) {
    const init = new Map<string, { playerCount: number; skillWeight: number }>();
    for (const sq of squads) {
      init.set(sq.id, { playerCount: sq.memberCount, skillWeight: sq.totalSkillWeight });
    }
    squadStateRef.current = init;
  }

  const skillGroups = uniqueSkillGroups(allUnassigned);
  const resolvedSkill = activeSkill === undefined ? (skillGroups[0] ?? null) : activeSkill;

  const assignedIds = useRef<Set<string>>(new Set());

  const pool = allUnassigned.filter(
    (u) => !assignedIds.current.has(u.registrationId) && u.skillLevel === resolvedSkill,
  );

  const totalRemaining = allUnassigned.filter(
    (u) => !assignedIds.current.has(u.registrationId),
  ).length;

  // Current target squad is always computed from live state — no pickIndex needed.
  const currentSquad: SquadView | undefined = pickTargetSquad(squads, squadStateRef.current);

  function start() {
    setPhase("main");
  }

  /**
   * Assign `player` to `squadId` (defaults to currentSquad via fairness algorithm)
   * and update the running skill-weight state.
   */
  async function assign(
    player: UnassignedRegistrationView,
    squadId?: string,
  ): Promise<Assignment | null> {
    const targetId = squadId ?? currentSquad?.id;
    const targetSquad = squads.find((s) => s.id === targetId);
    if (!targetId || !targetSquad) return null;

    setIsAssigning(true);
    try {
      await assignMutation
        .mutateAsync({
          squadId: targetId,
          registrationId: player.registrationId,
        })
        .catch((e) => {
          toast.error(errorMessage(e, "Couldn't assign player"));
          throw e;
        });

      assignedIds.current = new Set([...assignedIds.current, player.registrationId]);

      // Update running state so the next pickTargetSquad call sees this assignment.
      const prev = squadStateRef.current.get(targetId) ?? {
        playerCount: targetSquad.memberCount,
        skillWeight: targetSquad.totalSkillWeight,
      };
      squadStateRef.current = new Map(squadStateRef.current).set(targetId, {
        playerCount: prev.playerCount + 1,
        skillWeight: prev.skillWeight + player.skillWeight,
      });

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

    // Roll back the skill-weight state for this squad.
    const prev = squadStateRef.current.get(last.squadId);
    if (prev) {
      squadStateRef.current = new Map(squadStateRef.current).set(last.squadId, {
        playerCount: Math.max(0, prev.playerCount - 1),
        skillWeight: Math.max(0, prev.skillWeight - last.skillWeight),
      });
    }

    setHistory((h) => h.slice(0, -1));
    if (phase === "complete") setPhase("main");
    squadsQuery.refetch();
  }, [history, phase, squadsQuery]);

  function changeSkill(skill: string | null) {
    setActiveSkill(skill);
  }

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
    start,
    assign,
    undo,
    changeSkill,
    isLoading: squadsQuery.isLoading,
    isError: squadsQuery.isError,
  };
}
