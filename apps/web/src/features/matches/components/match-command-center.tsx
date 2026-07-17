"use client";

import type {
  CourtView,
  MatchView,
  ParticipantResponse,
  StageResponse,
} from "@tournament/api-client";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { TeamBadge } from "@/components/ui/team-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { matchStatusMeta } from "@/features/draws/config";
import { MatchHistoryList } from "@/features/matches/components/match-history-list";
import { ScoreEntryForm } from "@/features/matches/components/score-entry-form";
import {
  courtLabelFromMap,
  formatMatchScore,
  formatScheduledTime,
  isScoreable,
} from "@/features/matches/config";
import { ScorekeeperMatchLinkPanel } from "@/features/scoring/components/scorekeeper-match-link-panel";
import { useEnsureMatchLive } from "@/features/scoring/use-ensure-match-live";
import { getFormat } from "@/features/tournaments/config";
import { useIsDesktop } from "@/hooks/use-media-query";
import { errorMessage } from "@/lib/problem";
import { cn } from "@/lib/utils";

export type CommandCenterTab = "score" | "overview" | "scorekeeper" | "timeline";

function participantName(
  id: string | undefined,
  participantsById: Map<string, ParticipantResponse>,
): string {
  if (!id) return "TBD";
  return participantsById.get(id)?.displayName ?? "Unknown";
}

function MatchHeader({
  match,
  tournamentName,
  stagesById,
  courtsById,
  participantsById,
}: {
  match: MatchView;
  tournamentName: string;
  stagesById: Map<string, StageResponse>;
  courtsById: Map<string, CourtView>;
  participantsById: Map<string, ParticipantResponse>;
}) {
  const stage = stagesById.get(match.stageId);
  const status = matchStatusMeta(match.status);
  const scheduled = formatScheduledTime(match.scheduledAt);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex flex-wrap gap-1">
            {match.sides.map((s) => {
              const p = participantsById.get(s.participantId);
              return p?.teamName ? <TeamBadge key={s.participantId} teamName={p.teamName} /> : null;
            })}
          </div>
          <h2 className="font-serif text-xl font-semibold tracking-tight">
            {match.sides
              .map((s) => participantName(s.participantId, participantsById))
              .join(" vs ") || "TBD"}
          </h2>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <p className="text-muted-foreground text-sm">
        {tournamentName}
        {stage ? ` · ${getFormat(stage.type)?.label ?? stage.type}` : ""}
        {match.roundLabel ? ` · ${match.roundLabel}` : ""}
        {` · ${courtLabelFromMap(match.courtId, courtsById)}`}
        {scheduled ? ` · ${scheduled}` : ""}
      </p>
    </div>
  );
}

function OverviewTab({
  match,
  participantsById,
}: {
  match: MatchView;
  participantsById: Map<string, ParticipantResponse>;
}) {
  const [metaOpen, setMetaOpen] = useState(false);
  const score = formatMatchScore(match);
  const games = (match.resultPayload as Record<string, unknown>).games;

  return (
    <div className="flex flex-col gap-4">
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
      {score ? (
        <div>
          <h3 className="font-serif text-lg font-semibold tracking-tight">Result</h3>
          <p className="mt-1 font-mono text-sm font-semibold tabular-nums">{score}</p>
        </div>
      ) : null}
      {Array.isArray(games) && games.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {(games as number[][]).map((g, i) =>
            Array.isArray(g) && g.length === 2 ? (
              <span
                key={i}
                className="border-ink bg-card rounded-xl border-2 px-3 py-1 font-mono text-sm tabular-nums"
              >
                G{i + 1}: {g[0]}–{g[1]}
              </span>
            ) : null,
          )}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setMetaOpen((v) => !v)}
        className="text-muted-foreground flex items-center gap-1 text-xs font-semibold"
      >
        Match details
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", metaOpen && "rotate-180")} />
      </button>
      {metaOpen ? (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground text-2xs font-mono uppercase">Round</dt>
            <dd className="font-semibold">{match.roundLabel ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-2xs font-mono uppercase">Group</dt>
            <dd className="font-semibold">{match.groupName ?? "—"}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}

function CommandCenterBody({
  match,
  tournamentId,
  tournamentName,
  stagesById,
  participantsById,
  courtsById,
  canManage,
  defaultTab,
  startLiveOnOpen,
}: {
  match: MatchView;
  tournamentId: string;
  tournamentName: string;
  stagesById: Map<string, StageResponse>;
  participantsById: Map<string, ParticipantResponse>;
  courtsById: Map<string, CourtView>;
  canManage: boolean;
  defaultTab: CommandCenterTab;
  startLiveOnOpen: boolean;
}) {
  const scoreable = canManage && isScoreable(match.status);
  const resolvedDefault: CommandCenterTab =
    defaultTab === "score" && scoreable ? "score" : scoreable ? "score" : "overview";

  const [tab, setTab] = useState<CommandCenterTab>(resolvedDefault);
  const { ensureLive } = useEnsureMatchLive(match.id, tournamentId, match.status, match.stageId);

  useEffect(() => {
    setTab(resolvedDefault);
  }, [match.id, resolvedDefault]);

  useEffect(() => {
    if (!startLiveOnOpen || match.status !== "scheduled") return;
    void ensureLive(null).catch((e) => toast.error(errorMessage(e, "Couldn't start match")));
  }, [startLiveOnOpen, match.id, match.status, ensureLive]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MatchHeader
        match={match}
        tournamentName={tournamentName}
        stagesById={stagesById}
        courtsById={courtsById}
        participantsById={participantsById}
      />
      <Separator className="my-4" />
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as CommandCenterTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="w-full justify-start overflow-x-auto">
          {scoreable ? <TabsTrigger value="score">Score</TabsTrigger> : null}
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {scoreable ? <TabsTrigger value="scorekeeper">Scorekeeper</TabsTrigger> : null}
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>
        <div className="min-h-0 flex-1 overflow-y-auto pb-4 pt-4">
          {scoreable ? (
            <TabsContent value="score" className="mt-0">
              <ScoreEntryForm
                match={match}
                tournamentId={tournamentId}
                participantsById={participantsById}
                variant="hero"
              />
            </TabsContent>
          ) : null}
          <TabsContent value="overview" className="mt-0">
            <OverviewTab match={match} participantsById={participantsById} />
          </TabsContent>
          {scoreable ? (
            <TabsContent value="scorekeeper" className="mt-0">
              <ScorekeeperMatchLinkPanel matchId={match.id} showQr />
            </TabsContent>
          ) : null}
          <TabsContent value="timeline" className="mt-0">
            <MatchHistoryList matchId={match.id} enriched />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

/** Match Command Center — tabbed scoring and ops surface for a single match. */
export function MatchCommandCenter({
  match,
  tournamentId,
  tournamentName,
  stagesById,
  participantsById,
  courtsById,
  canManage,
  open,
  onOpenChange,
  defaultTab = "score",
  startLiveOnOpen = false,
}: {
  match: MatchView | null;
  tournamentId: string;
  tournamentName: string;
  stagesById: Map<string, StageResponse>;
  participantsById: Map<string, ParticipantResponse>;
  courtsById: Map<string, CourtView>;
  canManage: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: CommandCenterTab;
  /** When true (explicit "Start match" click), transition scheduled → live once on open. */
  startLiveOnOpen?: boolean;
}) {
  const isDesktop = useIsDesktop();

  if (!match) return null;

  const title = match.sides
    .map((s) => participantName(s.participantId, participantsById))
    .join(" vs ");

  if (!isDesktop) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="inset-x-0 bottom-0 top-0 h-[100dvh] w-full max-w-none rounded-none border-0"
        >
          <SheetTitle className="sr-only">{title}</SheetTitle>
          <SheetDescription className="sr-only">Match command center</SheetDescription>
          <CommandCenterBody
            match={match}
            tournamentId={tournamentId}
            tournamentName={tournamentName}
            stagesById={stagesById}
            participantsById={participantsById}
            courtsById={courtsById}
            canManage={canManage}
            defaultTab={defaultTab}
            startLiveOnOpen={startLiveOnOpen}
          />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden p-6">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Match command center</DialogDescription>
        </DialogHeader>
        <CommandCenterBody
          match={match}
          tournamentId={tournamentId}
          tournamentName={tournamentName}
          stagesById={stagesById}
          participantsById={participantsById}
          courtsById={courtsById}
          canManage={canManage}
          defaultTab={defaultTab}
          startLiveOnOpen={startLiveOnOpen}
        />
      </DialogContent>
    </Dialog>
  );
}
