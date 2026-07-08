"use client";

import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ContextualCta } from "@/features/matches/config";

export function OpsContextualCta({
  cta,
  onAction,
}: {
  cta: ContextualCta | null;
  onAction: (matchId: string, defaultTab: ContextualCta["defaultTab"]) => void;
}) {
  if (!cta) return null;

  return (
    <Button
      tone="candy"
      className="w-full justify-between sm:w-auto"
      onClick={() => onAction(cta.matchId, cta.defaultTab)}
    >
      {cta.label}
      <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
    </Button>
  );
}
