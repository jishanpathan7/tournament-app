"use client";

import { Download, Radio, Swords, Timer } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityFeedCompact } from "@/features/matches/components/activity-feed-compact";
import {
  MatchCommandCenter,
  type CommandCenterTab,
} from "@/features/matches/components/match-command-center";
import { MatchQueueFiltersPanel } from "@/features/matches/components/match-queue-filters-panel";
import { MatchQueueSections } from "@/features/matches/components/match-queue-sections";
import { OpsContextualCta } from "@/features/matches/components/ops-contextual-cta";
import { OpsSummaryRow } from "@/features/matches/components/ops-summary-row";
import { TournamentProgressPanel } from "@/features/matches/components/tournament-progress-panel";
import { useTournamentCourts } from "@/features/courts/use-courts";
import {
  applyMatchQueueFilters,
  applyQuickFilter,
  buildCourtsById,
  DEFAULT_MATCH_QUEUE_FILTERS,
  deriveContextualCta,
  deriveOpsSummary,
  deriveTournamentProgress,
  matchPrimaryAction,
} from "@/features/matches/config";
import {
  useTournamentMatches,
  useTournamentParticipants,
  useTournamentStages,
} from "@/features/matches/use-tournament-matches";
import { useScheduleQueue } from "@/features/scheduling/use-schedule";
import { MobileLiveStickyBar } from "@/features/scheduling/components/mobile-live-sticky-bar";
import { useTournament } from "@/features/tournaments/use-tournaments";
import { env } from "@/lib/env";
import { toast } from "@/components/ui/sonner";
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";
import { ApiError } from "@/lib/problem";

async function downloadCsv(url: string, filename: string) {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`${res.status}`);
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(href);
  } catch {
    toast.error("Export failed — try again");
  }
}

export function MatchCenter({ tournamentId }: { tournamentId: string }) {
  const can = useCan();
  const canManage = can(ACTIONS.SCORING_WRITE);

  const tournament = useTournament(tournamentId);
  const matches = useTournamentMatches(tournamentId);
  const stages = useTournamentStages(tournamentId);
  const participants = useTournamentParticipants(tournamentId);
  const queue = useScheduleQueue(tournamentId);
  const tournamentCourts = useTournamentCourts(tournamentId);

  const [filters, setFilters] = useState(DEFAULT_MATCH_QUEUE_FILTERS);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [commandTab, setCommandTab] = useState<CommandCenterTab>("score");
  const [startLiveOnOpen, setStartLiveOnOpen] = useState(false);

  const participantsById = useMemo(
    () => new Map((participants.data ?? []).map((p) => [p.id, p])),
    [participants.data],
  );
  const stagesById = useMemo(
    () => new Map((stages.data ?? []).map((s) => [s.id, s])),
    [stages.data],
  );
  const courtsById = useMemo(() => {
    const courts = (tournamentCourts.data ?? []).map((tc) => tc.court);
    const fromQueue = (queue.data?.courts ?? []).map((c) => c.court);
    return buildCourtsById([...courts, ...fromQueue]);
  }, [tournamentCourts.data, queue.data?.courts]);

  // Exclude TIE parent matches — they're squad-vs-squad containers, not scoreable entries.
  // Only standard and leg matches belong in the ops queue and progress counts.
  const scorableMatches = useMemo(
    () => (matches.data ?? []).filter((m) => m.contestKind !== "tie"),
    [matches.data],
  );

  const filtered = useMemo(() => {
    const base = applyMatchQueueFilters(scorableMatches, filters, participantsById);
    return applyQuickFilter(base, filters.quick);
  }, [scorableMatches, filters, participantsById]);

  const selectedMatch = scorableMatches.find((m) => m.id === selectedMatchId) ?? null;
  const opsSummary = useMemo(
    () => deriveOpsSummary(scorableMatches, queue.data),
    [scorableMatches, queue.data],
  );
  const progress = useMemo(
    () => deriveTournamentProgress(scorableMatches, stages.data ?? []),
    [scorableMatches, stages.data],
  );
  const contextualCta = useMemo(
    () => deriveContextualCta(scorableMatches, courtsById),
    [scorableMatches, courtsById],
  );

  const openMatch = (
    matchId: string,
    tab: CommandCenterTab = "score",
    opts?: { startLive?: boolean },
  ) => {
    setSelectedMatchId(matchId);
    setCommandTab(tab);
    setStartLiveOnOpen(opts?.startLive ?? false);
  };

  const openPrimaryAction = (matchId: string) => {
    const m = (matches.data ?? []).find((x) => x.id === matchId);
    const primary = m ? matchPrimaryAction(m) : { action: "view" as const };
    const tab: CommandCenterTab =
      primary.action === "score" || primary.action === "start" ? "score" : "overview";
    openMatch(matchId, tab, { startLive: primary.action === "start" });
  };

  if (tournament.isLoading || matches.isLoading || stages.isLoading || participants.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (tournament.isError || !tournament.data) {
    const notFound = tournament.error instanceof ApiError && tournament.error.isNotFound;
    return (
      <ErrorState
        error={tournament.error}
        onRetry={notFound ? undefined : () => tournament.refetch()}
        title={notFound ? "Tournament not found" : "Couldn't load tournament"}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-24 md:pb-0">
      <PageHeader
        eyebrow="Operations"
        title="Match center"
        description="What needs attention now — score live matches and keep the tournament moving."
        actions={
          <>
            <Button
              tone="paper"
              size="sm"
              disabled={!matches.data?.length}
              onClick={() =>
                void downloadCsv(
                  `${env.apiUrl}/api/v1/tournaments/${tournamentId}/export/matches.csv`,
                  "matches.csv",
                )
              }
            >
              <Download className="h-4 w-4" strokeWidth={2.25} />
              Export CSV
            </Button>
            <OpsContextualCta cta={contextualCta} onAction={openMatch} />
          </>
        }
      />

      {/* Mobile: single-line status chip so the match queue is immediately visible */}
      <div className="border-ink bg-muted/30 flex items-center gap-4 rounded-2xl border-2 px-4 py-2.5 md:hidden">
        <span className="flex items-center gap-1.5 text-sm">
          <Radio className="text-mint h-3.5 w-3.5" strokeWidth={2.5} />
          <span className="font-mono font-bold tabular-nums">{opsSummary.live}</span>
          <span className="text-muted-foreground">live</span>
        </span>
        <span className="flex items-center gap-1.5 text-sm">
          <Timer className="text-muted-foreground h-3.5 w-3.5" strokeWidth={2.25} />
          <span className="font-mono font-bold tabular-nums">{opsSummary.waitingToStart}</span>
          <span className="text-muted-foreground">waiting</span>
        </span>
        <span className="ml-auto font-mono text-sm font-bold tabular-nums">
          {opsSummary.progressPct}%
          <span className="text-muted-foreground ml-1 font-normal">done</span>
        </span>
      </div>

      {/* Desktop: full summary + progress panels */}
      <div className="hidden md:flex md:flex-col md:gap-6">
        <OpsSummaryRow
          summary={opsSummary}
          courtsHref={`/console/tournaments/${tournamentId}/live`}
        />

        <TournamentProgressPanel
          completed={progress.completed}
          total={progress.total}
          pct={progress.pct}
          byStage={progress.byStage}
        />
      </div>

      <MatchQueueFiltersPanel
        filters={filters}
        onChange={setFilters}
        stages={stages.data ?? []}
        matches={matches.data ?? []}
      />

      {matches.isError ? (
        <ErrorState
          error={matches.error}
          onRetry={() => matches.refetch()}
          title="Couldn't load matches"
        />
      ) : (matches.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Swords}
          title="No matches yet"
          description="Generate a draw for a stage to start scheduling matches."
          className="py-14"
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Swords}
          title="No matches match"
          description="Try different filters."
          action={
            <Button tone="paper" size="sm" onClick={() => setFilters(DEFAULT_MATCH_QUEUE_FILTERS)}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <MatchQueueSections
          matches={filtered}
          participantsById={participantsById}
          stagesById={stagesById}
          courtsById={courtsById}
          onOpen={(id) => openMatch(id, "overview")}
          onPrimaryAction={openPrimaryAction}
        />
      )}

      <ActivityFeedCompact tournamentId={tournamentId} onOpenMatch={(id) => openMatch(id)} />

      <MobileLiveStickyBar tournamentId={tournamentId} />

      <MatchCommandCenter
        match={selectedMatch}
        tournamentId={tournamentId}
        tournamentName={tournament.data.name}
        stagesById={stagesById}
        participantsById={participantsById}
        courtsById={courtsById}
        canManage={canManage}
        open={!!selectedMatch}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMatchId(null);
            setStartLiveOnOpen(false);
          }
        }}
        defaultTab={commandTab}
        startLiveOnOpen={startLiveOnOpen}
      />
    </div>
  );
}
