"use client";

import type { DivisionReadinessView } from "@tournament/api-client";
import { AlertTriangle, CheckCircle2, Circle, Shuffle } from "lucide-react";
import Link from "next/link";

import { ErrorState } from "@/components/common/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTournamentReadiness } from "@/features/registration-ops/use-registration-ops";

function ReadinessRow({
  view,
  tournamentId,
}: {
  view: DivisionReadinessView;
  tournamentId: string;
}) {
  const progressPct =
    view.approved > 0 ? Math.round((view.checkedIn / view.approved) * 100) : 0;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{view.divisionName}</p>
          <p className="text-xs text-muted-foreground capitalize mt-0.5">{view.participantType}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {view.readyForStart ? (
            <Badge tone="mint">Ready to start</Badge>
          ) : view.readyForDraw ? (
            <Badge tone="candy">Ready for draw</Badge>
          ) : (
            <Badge tone="muted">Not ready</Badge>
          )}
          {view.drawn && <Badge tone="ink">Draw done</Badge>}
        </div>
      </div>

      {/* Check-in progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-mint transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums w-16 text-right">
          {view.checkedIn}/{view.approved} checked in
        </span>
      </div>

      {/* Stat row */}
      <div className="flex flex-wrap gap-4 text-sm">
        <span>
          <span className="font-medium">{view.approved}</span>{" "}
          <span className="text-muted-foreground">approved</span>
        </span>
        <span className="text-mint font-medium">{view.checkedIn} in</span>
        {view.pending > 0 && (
          <span className="text-yellow-600 font-medium">{view.pending} pending</span>
        )}
        {view.absent > 0 && (
          <span className="text-pink font-medium">{view.absent} absent</span>
        )}
        {view.unpairedEntrants > 0 && (
          <span className="text-muted-foreground">
            {view.unpairedEntrants} unpaired
          </span>
        )}
      </div>

      {/* Blockers */}
      {view.blockers.length > 0 && (
        <ul className="flex flex-col gap-1">
          {view.blockers.map((b) => (
            <li key={b} className="flex items-center gap-1.5 text-xs text-yellow-600">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {b}
            </li>
          ))}
        </ul>
      )}

      {/* Quick link to check-in */}
      {!view.readyForStart && !view.drawn && (
        <Button asChild size="sm" tone="paper" className="self-start">
          <Link
            href={`/console/tournaments/${tournamentId}/divisions/${view.divisionId}/attendance`}
          >
            Manage check-in
          </Link>
        </Button>
      )}
    </div>
  );
}

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
