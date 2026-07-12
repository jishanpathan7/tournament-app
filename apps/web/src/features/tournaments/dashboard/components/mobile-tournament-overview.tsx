"use client";

import { CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { STEP_META, type TournamentStep } from "@/features/tournaments/dashboard/config";
import { cn } from "@/lib/utils";

const ALL_PREP_STEPS: TournamentStep[] = [1, 2, 3, 4, 5, 6, 7];
const FRANCHISE_SKIP: Set<TournamentStep> = new Set([3, 4]);

function stepHref(tournamentId: string, step: TournamentStep): string | null {
  const base = `/console/tournaments/${tournamentId}`;
  switch (step) {
    case 1:
      return base;
    case 2:
      return `${base}/players`;
    case 3:
    case 4:
      return `${base}/teams`;
    case 5:
      return `${base}/readiness`;
    case 6:
      return `${base}/draws`;
    case 7:
      return `${base}/courts`;
    default:
      return null;
  }
}

/** Mobile-first step card list — one focal question per screen width. */
export function MobileTournamentOverview({
  tournamentId,
  currentStep,
  franchiseMode = true,
}: {
  tournamentId: string;
  currentStep: TournamentStep;
  franchiseMode?: boolean;
}) {
  const PREP_STEPS = franchiseMode
    ? ALL_PREP_STEPS
    : ALL_PREP_STEPS.filter((s) => !FRANCHISE_SKIP.has(s));
  const totalSteps = PREP_STEPS.length;

  return (
    <div className="flex flex-col gap-3 md:hidden">
      {PREP_STEPS.map((step, idx) => {
        const meta = STEP_META[step];
        const isCurrent = step === currentStep;
        const isDone = step < currentStep;
        const href = stepHref(tournamentId, step);

        return (
          <Card
            key={step}
            className={cn(
              isCurrent && "border-candy bg-candy-tint/20",
              isDone && "opacity-80",
              !isCurrent && !isDone && "opacity-60",
            )}
          >
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex items-start gap-3">
                {isDone ? (
                  <CheckCircle2 className="text-mint-dark mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <Circle
                    className={cn(
                      "mt-0.5 h-5 w-5 shrink-0",
                      isCurrent ? "text-candy" : "text-muted-foreground/40",
                    )}
                    strokeWidth={isCurrent ? 2.5 : 2}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-2xs text-muted-foreground font-mono font-semibold uppercase tracking-widest">
                    Step {idx + 1} of {totalSteps}
                  </p>
                  <p className="font-semibold">{meta.label}</p>
                  {isCurrent ? (
                    <p className="text-muted-foreground mt-1 text-sm">{meta.description}</p>
                  ) : null}
                </div>
              </div>
              {isCurrent && href ? (
                <Button asChild tone="candy" size="sm" className="self-start">
                  <Link href={href}>Continue</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
