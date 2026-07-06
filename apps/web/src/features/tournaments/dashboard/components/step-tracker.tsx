"use client";

import { CheckCircle2, Circle, Dot } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { STEP_META, type TournamentStep } from "@/features/tournaments/dashboard/config";

const STEPS: TournamentStep[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

type StepStatus = "done" | "current" | "pending";

function stepStatus(step: TournamentStep, current: TournamentStep): StepStatus {
  if (step < current) return "done";
  if (step === current) return "current";
  return "pending";
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done")
    return <CheckCircle2 className="text-mint-dark h-4 w-4 shrink-0" strokeWidth={2.25} />;
  if (status === "current")
    return <Dot className="text-candy h-4 w-4 shrink-0" strokeWidth={3} />;
  return <Circle className="text-muted-foreground/40 h-4 w-4 shrink-0" strokeWidth={2} />;
}

export function TournamentStepTracker({
  tournamentId,
  step,
}: {
  tournamentId: string;
  step: TournamentStep;
}) {
  const visibleSteps = STEPS.filter((s) => STEP_META[s].phase !== "after" || s === step);

  return (
    <div className="border-border bg-card rounded-xl border p-4">
      <p className="text-muted-foreground mb-4 text-2xs font-mono font-semibold uppercase tracking-[0.18em]">
        Progress
      </p>
      <ol className="flex flex-col gap-1">
        {visibleSteps.map((s) => {
          const status = stepStatus(s, step);
          const meta = STEP_META[s];
          const isCurrent = status === "current";

          return (
            <li key={s}>
              <div
                className={cn(
                  "flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors",
                  isCurrent ? "bg-muted" : "hover:bg-muted/50",
                )}
              >
                <div className="mt-0.5">
                  <StepIcon status={status} />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-semibold leading-tight",
                      status === "pending" ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {meta.label}
                  </p>
                  {isCurrent ? (
                    <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
                      {meta.description}
                    </p>
                  ) : null}
                </div>
                <span
                  className={cn(
                    "text-2xs mt-0.5 shrink-0 font-mono tabular-nums",
                    status === "pending" ? "text-muted-foreground/40" : "text-muted-foreground",
                  )}
                >
                  {s}
                </span>
              </div>
              {s < (visibleSteps[visibleSteps.length - 1] ?? 10) ? (
                <div className="border-border ml-[19px] h-3 border-l" />
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="border-border mt-4 border-t pt-3">
        <Link
          href={`/console/tournaments/${tournamentId}`}
          className="text-candy-dark text-xs font-semibold hover:underline"
        >
          Back to dashboard →
        </Link>
      </div>
    </div>
  );
}
