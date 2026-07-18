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
import { TeamBadge } from "@/components/ui/team-badge";
import { matchStatusMeta } from "@/features/draws/config";
import {
  courtLabelFromMap,
  formatMatchScore,
  formatScheduledTime,
  matchPrimaryAction,
} from "@/features/matches/config";
import { ScorekeeperCopyButton } from "@/features/scoring/components/scorekeeper-copy-button";
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
  nested = false,
}: {
  match: MatchView;
  participantsById: Map<string, ParticipantResponse>;
  stagesById: Map<string, StageResponse>;
  courtsById: Map<string, CourtView>;
  focused?: boolean;
  onOpen: (matchId: string) => void;
  onPrimaryAction: (matchId: string) => void;
  /** Lighter row style when nested inside a queue section card. */
  nested?: boolean;
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
  const Shell = nested ? "div" : Card;

  return (
    <Shell
      role="button"
      tabIndex={0}
      aria-label={`Open match: ${label}`}
      onClick={() => onOpen(match.id)}
      onKeyDown={handleKeyDown}
      className={cn(
        "cursor-pointer rounded-xl p-4 transition-colors",
        nested
          ? "border-ink/12 hover:bg-muted/40 bg-card border"
          : "border-ink shadow-sticker-xs hover:bg-muted/30 border-2",
        focused && "ring-candy ring-2 ring-offset-2",
        match.status === "live" &&
          (nested ? "border-mint bg-mint-tint/25" : "border-mint bg-mint-tint/30"),
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 flex-col">
              <div className="flex flex-wrap gap-1">
                {match.sides.map((s) => {
                  const p = participantsById.get(s.participantId);
                  return p?.teamName ? (
                    <TeamBadge key={s.participantId} teamName={p.teamName} />
                  ) : null;
                })}
              </div>
              <p className="truncate font-semibold">{participantNames(match, participantsById)}</p>
            </div>
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
        <div className="flex shrink-0 items-center gap-2">
          {match.status === "live" && <ScorekeeperCopyButton matchId={match.id} />}
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
      </div>
    </Shell>
  );
}
