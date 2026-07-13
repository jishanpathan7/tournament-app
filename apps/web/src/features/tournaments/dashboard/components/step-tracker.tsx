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
  if (status === "current") return <Dot className="text-candy h-4 w-4 shrink-0" strokeWidth={3} />;
  return <Circle className="text-muted-foreground/40 h-4 w-4 shrink-0" strokeWidth={2} />;
}

export function TournamentStepTracker({
  step,
  tournamentId,
  variant = "sidebar",
  franchiseMode = true,
}: {
  step: TournamentStep;
  tournamentId?: string;
  variant?: "sidebar" | "primary";
  franchiseMode?: boolean;
}) {
  const visibleSteps = STEPS.filter(
    (s) =>
      (STEP_META[s].phase !== "after" || s === step) && (franchiseMode || (s !== 3 && s !== 4)),
  );

  return (
    <div
      className={cn(
        "border-border bg-card rounded-xl border p-4",
        variant === "primary" && "border-candy/20 shadow-sticker-xs",
      )}
    >
      <p className="text-muted-foreground text-2xs mb-4 font-mono font-semibold uppercase tracking-[0.18em]">
        {variant === "primary" ? "Your checklist" : "Progress"}
      </p>
      <ol className={cn("flex flex-col gap-1", variant === "primary" && "sm:grid sm:grid-cols-2")}>
        {visibleSteps.map((s) => {
          const status = stepStatus(s, step);
          const meta = STEP_META[s];
          const isCurrent = status === "current";
          const href =
            tournamentId && meta.hrefSuffix
              ? `/console/tournaments/${tournamentId}${meta.hrefSuffix}`
              : undefined;
          const inner = (
            <div
              className={cn(
                "flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors",
                isCurrent ? "bg-muted" : "hover:bg-muted/50",
                href && "cursor-pointer",
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
                {isCurrent && variant === "primary" ? (
                  <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
                    {meta.description}
                  </p>
                ) : null}
              </div>
            </div>
          );

          return <li key={s}>{href ? <Link href={href}>{inner}</Link> : inner}</li>;
        })}
      </ol>
    </div>
  );
}
