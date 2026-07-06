"use client";

import { CheckCircle2, ChevronRight, ClipboardList, Trophy, Users, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "playlane_welcome_dismissed";

interface Step {
  number: number;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
  done: boolean;
  locked: boolean;
  cta: { label: string; href: string } | null;
}

const STEPS: Step[] = [
  {
    number: 1,
    icon: ClipboardList,
    title: "Set up your organization",
    description: "You've named your workspace and chosen your primary sport. You're ready to go.",
    done: true,
    locked: false,
    cta: null,
  },
  {
    number: 2,
    icon: Trophy,
    title: "Create your first tournament",
    description:
      "Pick your sport, choose a format (round robin or knockout), add your divisions, and set your dates.",
    done: false,
    locked: false,
    cta: { label: "Create tournament", href: "/console/tournaments/new" },
  },
  {
    number: 3,
    icon: Users,
    title: "Add players & run your event",
    description:
      "Import players from a CSV, generate the draw, assign courts, and score matches live.",
    done: false,
    locked: true,
    cta: null,
  },
];

export function WelcomeGuide({ name }: { name?: string }) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  });

  if (dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome banner */}
      <div className="bg-ink text-white shadow-sticker relative flex flex-col gap-2 rounded-3xl border-2 border-ink p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-2xs font-mono font-semibold uppercase tracking-[0.2em] text-white/50">
            Welcome to Playlane
          </p>
          <h2 className="font-serif text-2xl font-semibold tracking-tight">
            {name ? `Hey ${name} — let's run your first tournament.` : "Let's run your first tournament."}
          </h2>
          <p className="text-sm text-white/60">
            Three steps. Takes about 5 minutes to get from zero to a live draw.
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss welcome guide"
          className="absolute right-4 top-4 rounded-lg p-1 text-white/40 transition-colors hover:text-white sm:static sm:shrink-0"
        >
          <X className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STEPS.map((step) => (
          <StepCard key={step.number} step={step} />
        ))}
      </div>
    </div>
  );
}

function StepCard({ step }: { step: Step }) {
  const Icon = step.icon;

  return (
    <div
      className={cn(
        "shadow-sticker flex flex-col gap-4 rounded-3xl border-2 p-5 transition-opacity",
        step.done
          ? "border-mint bg-mint-tint"
          : step.locked
            ? "border-border bg-card opacity-50"
            : "border-candy bg-candy-tint",
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "border-ink flex h-10 w-10 items-center justify-center rounded-xl border-2",
            step.done ? "bg-mint" : step.locked ? "bg-muted" : "bg-candy",
          )}
        >
          {step.done ? (
            <CheckCircle2 className="h-5 w-5 text-white" strokeWidth={2.25} />
          ) : (
            <Icon
              className={cn("h-5 w-5", step.locked ? "text-muted-foreground" : "text-white")}
              strokeWidth={2.25}
            />
          )}
        </div>
        <span className="text-2xs font-mono font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Step {step.number}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <p className="font-semibold leading-snug">{step.title}</p>
        <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
      </div>

      {step.cta ? (
        <Button asChild tone="candy" size="sm" className="mt-auto self-start">
          <Link href={step.cta.href}>
            {step.cta.label}
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
          </Link>
        </Button>
      ) : step.locked ? (
        <p className="text-muted-foreground mt-auto text-xs italic">Unlocks after step 2</p>
      ) : null}
    </div>
  );
}
