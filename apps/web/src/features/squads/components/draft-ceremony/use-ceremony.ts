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

export function useCeremony(tournamentId: string) {
  const squadsQuery = useSquads(tournamentId);
  const assignMutation = useAssignSquadMember(tournamentId);

  const [phase, setPhase] = useState<CeremonyPhase>("intro");
  const [activeSkill, setActiveSkill] = useState<string | null | undefined>(undefined);
  const [history, setHistory] = useState<Assignment[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);

  // Round-robin pick index: cycles through squads in order
  const [pickIndex, setPickIndex] = useState(0);

  const board = squadsQuery.data;
  const allUnassigned = board?.unassigned ?? [];
  const squads = board?.squads ?? [];

  const skillGroups = uniqueSkillGroups(allUnassigned);
  const resolvedSkill = activeSkill === undefined ? (skillGroups[0] ?? null) : activeSkill;

  const assignedIds = useRef<Set<string>>(new Set());

  const pool = allUnassigned.filter(
    (u) => !assignedIds.current.has(u.registrationId) && u.skillLevel === resolvedSkill,
  );

  const totalRemaining = allUnassigned.filter(
    (u) => !assignedIds.current.has(u.registrationId),
  ).length;

  // Which squad is picking right now
  const currentSquad: SquadView | undefined =
    squads.length > 0 ? squads[pickIndex % squads.length] : undefined;

  function start() {
    setPhase("main");
  }

  /**
   * Auto-assign `player` to `squadId` (defaults to currentSquad) and advance
   * the round-robin pick index.
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

      const record: Assignment = {
        registrationId: player.registrationId,
        displayName: player.displayName,
        squadId: targetId,
        squadName: targetSquad.name,
        skillLevel: player.skillLevel,
        pickNumber: history.length + 1,
      };
      setHistory((h) => [...h, record]);
      setPickIndex((p) => p + 1);

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
    setPickIndex((p) => Math.max(0, p - 1));
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
    pickIndex,
    isLoading: squadsQuery.isLoading,
    isError: squadsQuery.isError,
    start,
    assign,
    undo,
    changeSkill,
  };
}
