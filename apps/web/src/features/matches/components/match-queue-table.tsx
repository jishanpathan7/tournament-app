"use client";

import type { MatchView, ParticipantResponse, StageResponse } from "@tournament/api-client";
import type { KeyboardEvent } from "react";
import { useEffect, useRef } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { matchStatusMeta } from "@/features/draws/config";
import { courtLabel, stepFocusId } from "@/features/matches/config";
import { getFormat } from "@/features/tournaments/config";
import { useMatchCenterStore } from "@/stores/match-center-store";
import { cn } from "@/lib/utils";

function formatScore(match: MatchView): string | null {
  if (match.status === "walkover" || match.status === "no_show") return "Walkover";
  if (match.status !== "completed") return null;
  const games = (match.resultPayload as Record<string, unknown>).games;
  if (!Array.isArray(games) || games.length === 0) return null;
  return (games as number[][])
    .filter((g) => Array.isArray(g) && g.length === 2)
    .map(([a, b]) => `${a}–${b}`)
    .join(", ");
}

function participantNames(
  match: MatchView,
  participantsById: Map<string, ParticipantResponse>,
): string {
  if (match.sides.length === 0) return "TBD";
  return match.sides
    .map((s) => participantsById.get(s.participantId)?.displayName ?? "Unknown")
    .join(" vs ");
}

/**
 * The match queue. Arrow keys move focus row-to-row (clamped, not wrapping) via a small
 * Zustand store so focus survives independent of scroll/re-render; Enter/Space opens the
 * detail dialog for the focused row — a keyboard-first path from "scan the queue" to
 * "score a match" with no mouse required.
 */
export function MatchQueueTable({
  matches,
  participantsById,
  stagesById,
  onOpen,
}: {
  matches: MatchView[];
  participantsById: Map<string, ParticipantResponse>;
  stagesById: Map<string, StageResponse>;
  onOpen: (matchId: string) => void;
}) {
  const focusedMatchId = useMatchCenterStore((s) => s.focusedMatchId);
  const setFocusedMatchId = useMatchCenterStore((s) => s.setFocusedMatchId);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement | null>());
  const ids = matches.map((m) => m.id);

  useEffect(() => {
    if (focusedMatchId) rowRefs.current.get(focusedMatchId)?.focus();
  }, [focusedMatchId]);

  const onKeyDown = (e: KeyboardEvent<HTMLTableRowElement>, matchId: string) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedMatchId(stepFocusId(ids, matchId, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedMatchId(stepFocusId(ids, matchId, -1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(matchId);
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Stage</TableHead>
          <TableHead>Round</TableHead>
          <TableHead>Group</TableHead>
          <TableHead>Court</TableHead>
          <TableHead>Participants</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {matches.map((match) => {
          const stage = stagesById.get(match.stageId);
          const status = matchStatusMeta(match.status);
          return (
            <TableRow
              key={match.id}
              ref={(el) => {
                rowRefs.current.set(match.id, el);
              }}
              tabIndex={0}
              role="button"
              aria-label={`Open match: ${participantNames(match, participantsById)}`}
              className={cn(
                "focus-visible:bg-muted cursor-pointer outline-none",
                focusedMatchId === match.id && "bg-muted",
              )}
              onClick={() => {
                setFocusedMatchId(match.id);
                onOpen(match.id);
              }}
              onFocus={() => setFocusedMatchId(match.id)}
              onKeyDown={(e) => onKeyDown(e, match.id)}
            >
              <TableCell className="text-muted-foreground">
                {stage
                  ? `${getFormat(stage.type)?.label ?? stage.type} · Stage ${stage.seq + 1}`
                  : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">{match.roundLabel ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{match.groupName ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{courtLabel(match.courtId)}</TableCell>
              <TableCell className="font-semibold">
                {participantNames(match, participantsById)}
              </TableCell>
              <TableCell className="font-mono text-sm">
                {formatScore(match) ?? <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell>
                <Badge tone={status.tone}>{status.label}</Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
