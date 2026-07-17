"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { ConflictView, MatchView, ParticipantResponse } from "@tournament/api-client";
import { AlertTriangle, Clock, GripVertical, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TeamBadge } from "@/components/ui/team-badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { matchStatusMeta } from "@/features/draws/config";
import {
  conflictLabel,
  matchParticipantLabel,
  toDatetimeLocalValue,
} from "@/features/scheduling/config";
import { cn } from "@/lib/utils";

/** A draggable card for one match — dropped onto a court lane to schedule/move it, or
 * onto the "Unscheduled" lane to clear its court/time. Keyboard users can pick it up
 * with Space/Enter and move it with arrow keys (dnd-kit's built-in keyboard sensor).
 * The time itself is fine-tuned via a popover rather than pixel-precise dragging. */
export function ScheduleMatchCard({
  match,
  participantsById,
  conflicts,
  canManage,
  onClear,
  onRetime,
}: {
  match: MatchView;
  participantsById: Map<string, ParticipantResponse>;
  conflicts: ConflictView[];
  canManage: boolean;
  onClear?: () => void;
  onRetime?: (scheduledAt: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: match.id,
    data: { match },
    disabled: !canManage,
  });
  const statusMeta = matchStatusMeta(match.status);
  const label = matchParticipantLabel(match, participantsById);
  const time = match.scheduledAt
    ? new Date(match.scheduledAt).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;
  const [draftTime, setDraftTime] = useState(() =>
    match.scheduledAt ? toDatetimeLocalValue(new Date(match.scheduledAt)) : "",
  );

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "border-ink bg-card shadow-sticker-xs flex flex-col gap-1.5 rounded-xl border-2 p-2.5 text-sm",
        isDragging && "opacity-50",
        conflicts.length > 0 && "border-pink",
      )}
      data-match-id={match.id}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-1.5">
          {canManage ? (
            <button
              type="button"
              className="text-muted-foreground -ml-1 mt-0.5 cursor-grab touch-none active:cursor-grabbing"
              aria-label={`Drag ${label}`}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" strokeWidth={2.25} />
            </button>
          ) : null}
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex flex-wrap gap-1">
              {match.sides.map((s) => {
                const p = participantsById.get(s.participantId);
                return p?.teamName ? (
                  <TeamBadge key={s.participantId} teamName={p.teamName} />
                ) : null;
              })}
            </div>
            <span className="min-w-0 truncate font-medium">{label}</span>
          </div>
        </div>
        {canManage && onClear ? (
          <Button
            type="button"
            tone="ghost"
            size="icon-sm"
            className="h-6 w-6 shrink-0"
            aria-label={`Unschedule ${label}`}
            onClick={onClear}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.25} />
          </Button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
        {match.roundLabel ? (
          <span className="text-muted-foreground truncate text-xs">{match.roundLabel}</span>
        ) : null}
        {time && canManage && onRetime ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground ml-auto flex items-center gap-1 text-xs tabular-nums hover:underline"
                aria-label={`Change time for ${label}`}
              >
                <Clock className="h-3 w-3" strokeWidth={2.25} />
                {time}
              </button>
            </PopoverTrigger>
            <PopoverContent className="flex flex-col gap-2 p-3" align="end">
              <Input
                type="datetime-local"
                value={draftTime}
                onChange={(e) => setDraftTime(e.target.value)}
                className="h-9 text-sm"
                aria-label="Scheduled time"
              />
              <Button
                type="button"
                tone="candy"
                size="sm"
                className="h-8"
                onClick={() => {
                  if (draftTime) onRetime(new Date(draftTime).toISOString());
                }}
              >
                Save
              </Button>
            </PopoverContent>
          </Popover>
        ) : time ? (
          <span className="text-muted-foreground ml-auto text-xs tabular-nums">{time}</span>
        ) : null}
      </div>
      {conflicts.length > 0 ? (
        <div className="text-pink-dark flex items-start gap-1 text-xs">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
          <span>{conflicts.map((c) => conflictLabel(c.kind)).join(", ")}</span>
        </div>
      ) : null}
    </div>
  );
}
