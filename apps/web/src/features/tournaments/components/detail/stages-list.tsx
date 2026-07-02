"use client";

import type { StageResponse } from "@tournament/api-client";
import { GitMerge } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getFormat } from "@/features/tournaments/config";
import { useStages } from "@/features/tournaments/use-tournaments";

function StageRow({
  stage,
  tournamentId,
  divisionId,
}: {
  stage: StageResponse;
  tournamentId: string;
  divisionId: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold">{getFormat(stage.type)?.label ?? stage.type}</span>
        <span className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.16em]">
          Stage {stage.seq + 1}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={stage.drawn ? "mint" : "muted"}>{stage.drawn ? "Drawn" : "Not drawn"}</Badge>
        {stage.locked ? <Badge tone="ink">Locked</Badge> : null}
        <Button asChild tone="paper" size="sm">
          <Link
            href={`/console/tournaments/${tournamentId}/divisions/${divisionId}/stages/${stage.id}/draw`}
          >
            <GitMerge className="h-4 w-4" strokeWidth={2.25} />
            {stage.drawn ? "View draw" : "Set up draw"}
          </Link>
        </Button>
      </div>
    </div>
  );
}

/** Stages within a division, with draw status + a link into the draw workflow. */
export function StagesList({
  tournamentId,
  divisionId,
}: {
  tournamentId: string;
  divisionId: string;
}) {
  const { data, isLoading } = useStages(divisionId);

  if (isLoading) return <Skeleton className="h-10 border-0" />;
  if (!data || data.length === 0) {
    return <p className="text-muted-foreground text-sm">No stages configured for this division.</p>;
  }

  return (
    <div className="divide-border divide-y">
      {data.map((stage) => (
        <StageRow
          key={stage.id}
          stage={stage}
          tournamentId={tournamentId}
          divisionId={divisionId}
        />
      ))}
    </div>
  );
}
