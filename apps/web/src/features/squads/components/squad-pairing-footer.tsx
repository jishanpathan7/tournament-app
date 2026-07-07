"use client";

import { CheckCircle2, GitMerge, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePairing } from "@/features/pairing/use-pairing";
import type { SquadView } from "@/features/squads/types";

/**
 * Pairing status footer rendered inside each team card.
 * Shows current pairing state and the one action available at this stage.
 */
export function SquadPairingFooter({
  squad,
  divisionId,
  canManage,
  onOpen,
}: {
  squad: SquadView;
  divisionId: string;
  canManage: boolean;
  onOpen: () => void;
}) {
  const pairing = usePairing(divisionId, { squadId: squad.id });
  const run = pairing.data ?? null;
  const isPublished = run?.status === "published";
  const pairCount = run?.teams.length ?? 0;
  const hasPairs = pairCount > 0;

  if (pairing.isLoading) {
    return (
      <div className="border-ink/10 flex items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking pairs…
      </div>
    );
  }

  if (isPublished) {
    return (
      <div className="border-ink/10 flex items-center justify-between gap-2 border-t px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs">
          <CheckCircle2 className="text-mint-dark h-3.5 w-3.5" />
          <span className="font-semibold text-mint-dark">{pairCount} pairs locked</span>
        </div>
        <Button tone="ghost" size="sm" onClick={onOpen} className="h-6 px-2 text-xs">
          View Pairs
        </Button>
      </div>
    );
  }

  if (hasPairs) {
    return (
      <div className="border-ink/10 flex items-center justify-between gap-2 border-t px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Badge tone="yellow" className="text-2xs">{pairCount} pairs · unpublished</Badge>
        </div>
        {canManage && (
          <Button tone="paper" size="sm" onClick={onOpen} className="h-6 px-2 text-xs">
            Review &amp; Lock
          </Button>
        )}
      </div>
    );
  }

  // No pairs yet
  if (!canManage || squad.memberCount < 2) return null;

  return (
    <div className="border-ink/10 border-t px-3 py-2">
      <Button tone="candy" size="sm" onClick={onOpen} className="w-full">
        <GitMerge className="h-3.5 w-3.5" />
        Generate Doubles Pairs
      </Button>
    </div>
  );
}
