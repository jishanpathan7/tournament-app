"use client";

import type { MatchView, ParticipantResponse, StageResponse } from "@tournament/api-client";
import type { CourtView } from "@tournament/api-client";

import {
  MatchCommandCenter,
  type CommandCenterTab,
} from "@/features/matches/components/match-command-center";

export type { CommandCenterTab };

/** @deprecated Use MatchCommandCenter — kept as alias for existing imports. */
export function MatchDetailDialog({
  match,
  tournamentId,
  tournamentName,
  stagesById,
  participantsById,
  canManage,
  open,
  onOpenChange,
  defaultTab = "score",
  courtsById = new Map<string, CourtView>(),
}: {
  match: MatchView | null;
  tournamentId: string;
  tournamentName: string;
  stagesById: Map<string, StageResponse>;
  participantsById: Map<string, ParticipantResponse>;
  canManage: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: CommandCenterTab;
  courtsById?: Map<string, CourtView>;
}) {
  return (
    <MatchCommandCenter
      match={match}
      tournamentId={tournamentId}
      tournamentName={tournamentName}
      stagesById={stagesById}
      participantsById={participantsById}
      courtsById={courtsById}
      canManage={canManage}
      open={open}
      onOpenChange={onOpenChange}
      defaultTab={defaultTab}
    />
  );
}
