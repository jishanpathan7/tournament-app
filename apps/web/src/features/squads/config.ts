import type { PairingRunView } from "@tournament/api-client";

import type { SquadView } from "@/features/squads/types";

export const TEAM_COUNT_PRESETS = [4, 6, 8] as const;

export const SQUAD_TINTS = [
  "bg-candy-tint",
  "bg-mint-tint",
  "bg-yellow-tint",
  "bg-pink-tint",
] as const;

export const SQUAD_BORDER_TINTS = [
  "border-l-candy",
  "border-l-mint",
  "border-l-yellow",
  "border-l-pink",
] as const;

export function squadTint(index: number): string {
  return SQUAD_TINTS[index % SQUAD_TINTS.length] ?? "bg-muted";
}

export function squadBorderTint(index: number): string {
  return SQUAD_BORDER_TINTS[index % SQUAD_BORDER_TINTS.length] ?? "border-l-muted";
}

export type SquadPairingStatus = "loading" | "none" | "draft" | "published";

export function pairingStatusFromRun(
  run: PairingRunView | null | undefined,
  isLoading: boolean,
): SquadPairingStatus {
  if (isLoading) return "loading";
  if (!run || run.teams.length === 0) return "none";
  if (run.status === "published") return "published";
  return "draft";
}

export interface WorkflowState {
  teamsCreated: boolean;
  playersAssigned: boolean;
  teamsPaired: boolean;
  readyForDraw: boolean;
  /** True when every squad's pairing run has been published (locked). */
  allPairsLocked: boolean;
  currentStep: number;
  /** Squads with published (locked) pairing runs. */
  pairedCount: number;
  /** Squads with draft pairs awaiting lock. */
  draftCount: number;
  /** Squads with any pairs generated (draft or published). */
  generatedCount: number;
  totalSquads: number;
  nextSquad: SquadView | null;
  /** What the organizer should do for ``nextSquad``. */
  nextSquadAction: "generate" | "review" | null;
}

export function computeWorkflowState(
  squads: SquadView[],
  unassigned: number,
  pairingStatuses: Map<string, SquadPairingStatus>,
): WorkflowState {
  const totalSquads = squads.length;
  const teamsCreated = totalSquads > 0;
  const playersAssigned = teamsCreated && unassigned === 0;
  const pairedCount = squads.filter((s) => pairingStatuses.get(s.id) === "published").length;
  const draftCount = squads.filter((s) => pairingStatuses.get(s.id) === "draft").length;
  const generatedCount = pairedCount + draftCount;
  const allPairsGenerated = playersAssigned && totalSquads > 0 && generatedCount === totalSquads;
  const allPairsLocked = playersAssigned && totalSquads > 0 && pairedCount === totalSquads;
  /** Pairing step complete — every squad has a generated draft (lock optional until draw). */
  const teamsPaired = allPairsGenerated;
  const readyForDraw = allPairsGenerated;

  let currentStep = 0;
  if (!teamsCreated) currentStep = 0;
  else if (!playersAssigned) currentStep = 1;
  else if (!allPairsGenerated) currentStep = 2;
  else currentStep = 3;

  const nextNone = squads.find((s) => pairingStatuses.get(s.id) === "none") ?? null;
  const nextSquad = allPairsGenerated ? null : nextNone;
  const nextSquadAction = nextNone ? "generate" : null;

  return {
    teamsCreated,
    playersAssigned,
    teamsPaired,
    readyForDraw,
    allPairsLocked,
    currentStep,
    pairedCount,
    draftCount,
    generatedCount,
    totalSquads,
    nextSquad,
    nextSquadAction,
  };
}
