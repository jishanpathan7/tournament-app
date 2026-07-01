"use client";

import type { StageResponse } from "@tournament/api-client";
import { Shuffle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { getFormat } from "@/features/tournaments/config";
import { useGenerateDraw, useStages } from "@/features/tournaments/use-tournaments";
import { errorMessage } from "@/lib/problem";

function StageRow({
  stage,
  divisionId,
  canManage,
}: {
  stage: StageResponse;
  divisionId: string;
  canManage: boolean;
}) {
  const draw = useGenerateDraw(stage.id, divisionId);
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
        {!stage.drawn && canManage ? (
          <Button
            tone="paper"
            size="sm"
            disabled={draw.isPending}
            onClick={() =>
              draw.mutate(
                {},
                {
                  onSuccess: (r) => toast.success(`Draw created — ${r.matches} matches`),
                  onError: (e) => toast.error(errorMessage(e, "Couldn't generate draw")),
                },
              )
            }
          >
            {draw.isPending ? <Spinner /> : <Shuffle className="h-4 w-4" strokeWidth={2.25} />}
            Generate draw
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Stages within a division, with draw status + a gated generate action. */
export function StagesList({ divisionId, canManage }: { divisionId: string; canManage: boolean }) {
  const { data, isLoading } = useStages(divisionId);

  if (isLoading) return <Skeleton className="h-10 border-0" />;
  if (!data || data.length === 0) {
    return <p className="text-muted-foreground text-sm">No stages configured for this division.</p>;
  }

  return (
    <div className="divide-border divide-y">
      {data.map((stage) => (
        <StageRow key={stage.id} stage={stage} divisionId={divisionId} canManage={canManage} />
      ))}
    </div>
  );
}
