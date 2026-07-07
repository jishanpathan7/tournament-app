"use client";

import type { MatchView, ParticipantResponse, StageResponse } from "@tournament/api-client";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { matchStatusMeta } from "@/features/draws/config";
import { courtLabel, isScoreable } from "@/features/matches/config";
import { MatchHistoryList } from "@/features/matches/components/match-history-list";
import { ScoreEntryForm } from "@/features/matches/components/score-entry-form";
import { ScorekeeperMatchLinkPanel } from "@/features/scoring/components/scorekeeper-match-link-panel";
import { getFormat } from "@/features/tournaments/config";

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.16em]">
        {label}
      </dt>
      <dd className="text-sm font-semibold">{value}</dd>
    </div>
  );
}

function participantName(
  id: string | undefined,
  participantsById: Map<string, ParticipantResponse>,
): string {
  if (!id) return "TBD";
  return participantsById.get(id)?.displayName ?? "Unknown";
}

/**
 * Full detail for one match: participants/teams, tournament context (stage/round/
 * group/court), current status, score entry (when there's something to score), and its
 * history. The `match` prop should be derived fresh from the live query each render (not
 * a frozen snapshot) so scoring it updates this dialog in place — see `MatchQueue`.
 */
export function MatchDetailDialog({
  match,
  tournamentId,
  tournamentName,
  stagesById,
  participantsById,
  canManage,
  open,
  onOpenChange,
}: {
  match: MatchView | null;
  tournamentId: string;
  tournamentName: string;
  stagesById: Map<string, StageResponse>;
  participantsById: Map<string, ParticipantResponse>;
  canManage: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!match) return null;
  const stage = stagesById.get(match.stageId);
  const status = matchStatusMeta(match.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle className="text-xl">
              {match.sides
                .map((s) => participantName(s.participantId, participantsById))
                .join(" vs ")}
            </DialogTitle>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <DialogDescription>
            {tournamentName}
            {stage
              ? ` · ${getFormat(stage.type)?.label ?? stage.type} · Stage ${stage.seq + 1}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-3 gap-4">
          <MetaItem label="Round" value={match.roundLabel ?? "—"} />
          <MetaItem label="Group" value={match.groupName ?? "—"} />
          <MetaItem label="Court" value={courtLabel(match.courtId)} />
        </dl>

        <Separator />

        <div className="flex flex-col gap-2">
          <h3 className="font-serif text-lg font-semibold tracking-tight">Participants</h3>
          {match.sides.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Waiting on an earlier match to be decided.
            </p>
          ) : (
            match.sides.map((side) => (
              <div
                key={side.participantId}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className={side.outcome === "win" ? "font-bold" : ""}>
                  {participantName(side.participantId, participantsById)}
                </span>
                {side.scoreFor !== null ? (
                  <span className="text-muted-foreground font-mono text-xs">
                    {side.scoreFor} · {side.scoreAgainst}
                  </span>
                ) : null}
              </div>
            ))
          )}
        </div>

        {canManage && isScoreable(match.status) ? (
          <>
            <Separator />
            <ScorekeeperMatchLinkPanel matchId={match.id} />
            <div className="flex flex-col gap-3">
              <h3 className="font-serif text-lg font-semibold tracking-tight">
                {match.status === "scheduled" ? "Enter result" : "Correct result"}
              </h3>
              <ScoreEntryForm
                match={match}
                tournamentId={tournamentId}
                participantsById={participantsById}
              />
            </div>
          </>
        ) : null}

        <Separator />
        <div className="flex flex-col gap-2">
          <h3 className="font-serif text-lg font-semibold tracking-tight">History</h3>
          <MatchHistoryList matchId={match.id} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
