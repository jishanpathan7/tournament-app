"use client";

import { AlertTriangle, CheckCircle2, Circle, Shuffle } from "lucide-react";

import { ErrorState } from "@/components/common/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useTournamentReadiness } from "@/features/registration-ops/use-registration-ops";
import { ReadinessRow } from "@/features/registration-ops/components/readiness-row";

export function ReadinessDashboard({ tournamentId }: { tournamentId: string }) {
  const readiness = useTournamentReadiness(tournamentId);

  if (readiness.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (readiness.isError) {
    return <ErrorState error={readiness.error} onRetry={() => readiness.refetch()} />;
  }

  const data = readiness.data!;
  const allReady = data.divisions.every((d) => d.readyForDraw || d.readyForStart);
  const totalApproved = data.divisions.reduce((s, d) => s + d.approved, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Tournament-level summary */}
      <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-muted/30 px-5 py-4">
        {allReady ? (
          <CheckCircle2 className="h-5 w-5 text-mint shrink-0" />
        ) : data.totalPending > 0 ? (
          <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 text-sm">
          <span className="font-semibold">{data.totalCheckedIn}</span> of{" "}
          <span className="font-semibold">{totalApproved}</span> participants checked in across{" "}
          {data.divisions.length} division{data.divisions.length !== 1 ? "s" : ""}
          {data.totalPending > 0 && (
            <span className="text-yellow-600 ml-2">· {data.totalPending} still pending</span>
          )}
        </div>
        {allReady && (
          <div className="flex items-center gap-1 text-mint text-sm font-medium">
            <Shuffle className="h-4 w-4" strokeWidth={2.25} />
            All divisions ready
          </div>
        )}
      </div>

      {data.divisions.map((div) => (
        <ReadinessRow key={div.divisionId} view={div} tournamentId={tournamentId} />
      ))}
    </div>
  );
}
