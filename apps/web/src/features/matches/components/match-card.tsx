"use client";

import type {
  CourtView,
  MatchView,
  ParticipantResponse,
  StageResponse,
} from "@tournament/api-client";
import type { KeyboardEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { matchStatusMeta } from "@/features/draws/config";
import {
  courtLabelFromMap,
  formatMatchScore,
  formatScheduledTime,
  matchPrimaryAction,
} from "@/features/matches/config";
import { getFormat } from "@/features/tournaments/config";
import { cn } from "@/lib/utils";

function participantNames(
  match: MatchView,
  participantsById: Map<string, ParticipantResponse>,
): string {
  if (match.sides.length === 0) return "TBD";
  return match.sides
    .map((s) => participantsById.get(s.participantId)?.displayName ?? "Unknown")
    .join(" vs ");
}

export function MatchCard({
  match,
  participantsById,
  stagesById,
  courtsById,
  focused,
  onOpen,
  onPrimaryAction,
}: {
  match: MatchView;
  participantsById: Map<string, ParticipantResponse>;
  stagesById: Map<string, StageResponse>;
  courtsById: Map<string, CourtView>;
  focused?: boolean;
  onOpen: (matchId: string) => void;
  onPrimaryAction: (matchId: string) => void;
}) {
  const status = matchStatusMeta(match.status);
  const stage = stagesById.get(match.stageId);
  const score = formatMatchScore(match);
  const primary = matchPrimaryAction(match);
  const scheduled = formatScheduledTime(match.scheduledAt);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(match.id);
    }
  };

  const label = participantNames(match, participantsById);

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`Open match: ${label}`}
      onClick={() => onOpen(match.id)}
      onKeyDown={handleKeyDown}
      className={cn(
        "border-ink shadow-sticker-xs hover:bg-muted/30 cursor-pointer border-2 p-4 transition-colors",
        focused && "ring-candy ring-2 ring-offset-2",
        match.status === "live" && "border-mint bg-mint-tint/30",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold">{participantNames(match, participantsById)}</p>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <span>{courtLabelFromMap(match.courtId, courtsById)}</span>
            {match.roundLabel ? <span>{match.roundLabel}</span> : null}
            {stage ? <span>{getFormat(stage.type)?.label ?? stage.type}</span> : null}
            {scheduled ? <span>{scheduled}</span> : null}
          </div>
          {score ? (
            <p className="mt-2 font-mono text-sm font-semibold tabular-nums">{score}</p>
          ) : null}
        </div>
        <Button
          type="button"
          tone={primary.action === "score" || primary.action === "start" ? "candy" : "paper"}
          size="sm"
          className="shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onPrimaryAction(match.id);
          }}
        >
          {primary.label}
        </Button>
      </div>
    </Card>
  );
}
