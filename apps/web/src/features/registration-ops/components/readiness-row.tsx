"use client";

import type { DivisionReadinessView } from "@tournament/api-client";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ReadinessRow({
  view,
  tournamentId,
  compact,
}: {
  view: DivisionReadinessView;
  tournamentId: string;
  compact?: boolean;
}) {
  const progressPct =
    view.approved > 0 ? Math.round((view.checkedIn / view.approved) * 100) : 0;

  return (
    <div
      className={
        compact
          ? "flex flex-col gap-2 rounded-xl border border-border p-3"
          : "flex flex-col gap-3 rounded-2xl border border-border p-4"
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{view.divisionName}</p>
          <p className="text-muted-foreground mt-0.5 text-xs capitalize">{view.participantType}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {view.readyForStart ? (
            <Badge tone="mint">Ready to start</Badge>
          ) : view.readyForDraw ? (
            <Badge tone="candy">Ready for draw</Badge>
          ) : (
            <Badge tone="muted">Not ready</Badge>
          )}
          {view.drawn ? <Badge tone="ink">Draw done</Badge> : null}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
          <div
            className="bg-mint h-full rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-muted-foreground w-16 text-right text-xs tabular-nums">
          {view.checkedIn}/{view.approved} in
        </span>
      </div>

      {!compact ? (
        <div className="flex flex-wrap gap-4 text-sm">
          <span>
            <span className="font-medium">{view.approved}</span>{" "}
            <span className="text-muted-foreground">approved</span>
          </span>
          {view.pending > 0 ? (
            <span className="font-medium text-yellow-600">{view.pending} pending</span>
          ) : null}
          {view.unpairedEntrants > 0 ? (
            <span className="text-muted-foreground">{view.unpairedEntrants} unpaired</span>
          ) : null}
        </div>
      ) : null}

      {view.blockers.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {view.blockers.map((b) => (
            <li key={b} className="flex items-center gap-1.5 text-xs text-yellow-600">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {b}
            </li>
          ))}
        </ul>
      ) : null}

      {!view.readyForStart && !view.drawn ? (
        <Button asChild size="sm" tone="paper" className="self-start">
          <Link
            href={`/console/tournaments/${tournamentId}/divisions/${view.divisionId}/attendance`}
          >
            Manage check-in
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
