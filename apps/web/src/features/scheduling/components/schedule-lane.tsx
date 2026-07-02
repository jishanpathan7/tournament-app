"use client";

import { useDroppable } from "@dnd-kit/core";
import type { ConflictView, MatchView, ParticipantResponse } from "@tournament/api-client";

import { Badge } from "@/components/ui/badge";
import { courtStatusMeta } from "@/features/courts/config";
import { ScheduleMatchCard } from "@/features/scheduling/components/schedule-match-card";
import { cn } from "@/lib/utils";

/** One droppable column — either a court (drop = schedule onto this court) or the
 * "Unscheduled" queue (drop = clear the match's court/time). */
export function ScheduleLane({
  id,
  title,
  subtitle,
  courtStatus,
  matches,
  participantsById,
  conflictsByMatch,
  canManage,
  onClear,
  onRetime,
  emptyLabel,
}: {
  id: string;
  title: string;
  subtitle?: string;
  courtStatus?: string;
  matches: MatchView[];
  participantsById: Map<string, ParticipantResponse>;
  conflictsByMatch: Map<string, ConflictView[]>;
  canManage: boolean;
  onClear?: (matchId: string) => void;
  onRetime?: (matchId: string, scheduledAt: string) => void;
  emptyLabel: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !canManage });
  const statusMeta = courtStatus ? courtStatusMeta(courtStatus) : null;

  return (
    <div className="flex min-w-[16rem] flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{title}</span>
          {subtitle ? <span className="text-muted-foreground text-xs">{subtitle}</span> : null}
        </div>
        {statusMeta && courtStatus !== "active" ? (
          <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
        ) : null}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "border-ink bg-muted/40 flex min-h-[10rem] flex-1 flex-col gap-2 rounded-2xl border-2 border-dashed p-2 transition-colors",
          isOver && canManage && "border-candy bg-candy-tint/40",
        )}
      >
        {matches.length === 0 ? (
          <p className="text-muted-foreground m-auto max-w-[10rem] text-center text-xs">
            {emptyLabel}
          </p>
        ) : (
          matches.map((match) => (
            <ScheduleMatchCard
              key={match.id}
              match={match}
              participantsById={participantsById}
              conflicts={conflictsByMatch.get(match.id) ?? []}
              canManage={canManage}
              onClear={onClear && match.courtId ? () => onClear(match.id) : undefined}
              onRetime={onRetime ? (scheduledAt) => onRetime(match.id, scheduledAt) : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}
