"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { usePairingTierCheck } from "@/features/franchise-ties/use-franchise-ties";

/**
 * Pre-flight fairness signal, shown before the organizer generates matches.
 *
 * The draw pairs leg N against leg N after ordering each team's pairs by
 * strength, so a fair tier-for-tier fixture (advanced-v-advanced …
 * beginner-v-beginner) only holds when every team shares the same strength
 * shape. Manual pairing can't enforce that, so this catches an off-sheet pair
 * up front rather than on court.
 *
 * Renders nothing until there's a verdict — while pairings are still unpublished
 * the endpoint errors, and the surrounding empty state already says to publish
 * them first, so there's nothing useful to add here yet.
 */
export function PairingTierCheckBadge({ stageId }: { stageId: string }) {
  const check = usePairingTierCheck(stageId);

  if (check.isLoading || check.isError || !check.data) return null;

  const { aligned, deviatingSquads } = check.data;

  if (aligned) {
    return (
      <div className="border-mint bg-mint-tint/40 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm">
        <CheckCircle2 className="text-mint-dark mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} />
        <div className="flex flex-col gap-0.5">
          <span className="text-foreground font-semibold">Pairings aligned</span>
          <span className="text-muted-foreground">
            Every team has the same pair-strength shape, so each leg is an equal matchup — advanced
            plays advanced, beginner plays beginner. Safe to generate.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="border-pink bg-pink-tint/40 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm">
      <AlertTriangle className="text-pink-dark mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} />
      <div className="flex flex-col gap-0.5">
        <span className="text-foreground font-semibold">
          {deviatingSquads.length === 1
            ? `${deviatingSquads[0]}'s pairs don't match the others`
            : `${deviatingSquads.length} teams' pairs don't match the others`}
        </span>
        <span className="text-muted-foreground">
          {deviatingSquads.length > 1 ? (
            <>
              <span className="text-foreground font-medium">{deviatingSquads.join(", ")}</span> were
              paired off the fixed combinations.{" "}
            </>
          ) : null}
          Their pairs will meet uneven matchups (an advanced pair against beginners). Fix the pairs
          to the standard combinations before generating, or the fixtures won&apos;t be fair.
        </span>
      </div>
    </div>
  );
}
