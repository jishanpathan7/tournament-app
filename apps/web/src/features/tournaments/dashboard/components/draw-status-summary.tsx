"use client";

import type { DivisionResponse, StageResponse } from "@tournament/api-client";
import Link from "next/link";
import { GitMerge } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getFormat } from "@/features/tournaments/config";

export function DrawStatusSummary({
  tournamentId,
  divisions,
  stagesByDivision,
  drawProgress,
}: {
  tournamentId: string;
  divisions: DivisionResponse[];
  stagesByDivision: Map<string, StageResponse[]>;
  drawProgress: { drawn: number; total: number };
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <GitMerge className="h-5 w-5" strokeWidth={2.25} />
          Bracket status
          <Badge
            tone={
              drawProgress.drawn === drawProgress.total && drawProgress.total > 0 ? "mint" : "muted"
            }
          >
            {drawProgress.drawn}/{drawProgress.total}
          </Badge>
        </CardTitle>
        <Link
          href={`/console/tournaments/${tournamentId}/draws`}
          className="text-candy-dark shrink-0 text-xs font-semibold"
        >
          Manage draws →
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {divisions.map((division) => {
          const stages = stagesByDivision.get(division.id) ?? [];
          return (
            <div key={division.id} className="flex flex-col gap-1">
              <p className="text-sm font-semibold">{division.name}</p>
              {stages.length === 0 ? (
                <p className="text-muted-foreground text-xs">No stages</p>
              ) : (
                stages.map((stage) => (
                  <Link
                    key={stage.id}
                    href={`/console/tournaments/${tournamentId}/divisions/${division.id}/stages/${stage.id}/draw`}
                    className="text-muted-foreground hover:text-foreground flex items-center justify-between text-xs"
                  >
                    <span>
                      {getFormat(stage.type)?.label ?? stage.type} · Stage {stage.seq + 1}
                    </span>
                    <Badge tone={stage.drawn ? "mint" : "muted"}>
                      {stage.drawn ? "Built" : "Not built"}
                    </Badge>
                  </Link>
                ))
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
