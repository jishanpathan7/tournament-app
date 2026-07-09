"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StageProgressRow } from "@/features/matches/config";
import { cn } from "@/lib/utils";

export function TournamentProgressPanel({
  completed,
  total,
  pct,
  byStage,
}: {
  completed: number;
  total: number;
  pct: number;
  byStage: StageProgressRow[];
}) {
  if (total === 0) return null;

  return (
    <Card className="border-ink shadow-sticker-xs border-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Tournament progress</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Matches completed</span>
            <span className="font-mono font-semibold tabular-nums">
              {completed} / {total} ({pct}%)
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="border-ink bg-muted h-2.5 overflow-hidden rounded-full border-2"
          >
            <div
              className="bg-mint h-full rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        {byStage.length > 0 ? (
          <div className="flex flex-col gap-3">
            {byStage.map((row) => (
              <div key={row.stageId}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium">{row.label}</span>
                  <span className="text-muted-foreground font-mono tabular-nums">
                    {row.completed}/{row.total}
                  </span>
                </div>
                <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                  <div
                    className={cn("h-full rounded-full", row.pct === 100 ? "bg-mint" : "bg-candy")}
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
