"use client";

import { Swords } from "lucide-react";
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
import { MatchQueueAdvancedFilters } from "@/features/matches/components/match-queue-advanced-filters";
import { MatchQueueQuickFilters } from "@/features/matches/components/match-queue-quick-filters";
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
} from "@/features/matches/config";
import {
  useTournamentMatches,
  useTournamentParticipants,
  useTournamentStages,
} from "@/features/matches/use-tournament-matches";
import { useScheduleQueue } from "@/features/scheduling/use-schedule";
import { MobileLiveStickyBar } from "@/features/scheduling/components/mobile-live-sticky-bar";
import { useTournament } from "@/features/tournaments/use-tournaments";
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";
import { ApiError } from "@/lib/problem";

/**
 * Tournament Operations Center — prioritized match queue, live summary, and command
 * center for scoring. Realtime invalidation keeps the queue current without refresh.
 */
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

  const filtered = useMemo(() => {
    const base = applyMatchQueueFilters(matches.data ?? [], filters, participantsById);
    return applyQuickFilter(base, filters.quick);
  }, [matches.data, filters, participantsById]);

  const selectedMatch = matches.data?.find((m) => m.id === selectedMatchId) ?? null;
  const opsSummary = useMemo(
    () => deriveOpsSummary(matches.data ?? [], queue.data),
    [matches.data, queue.data],
  );
  const progress = useMemo(
    () => deriveTournamentProgress(matches.data ?? [], stages.data ?? []),
    [matches.data, stages.data],
  );
  const contextualCta = useMemo(
    () => deriveContextualCta(matches.data ?? [], courtsById),
    [matches.data, courtsById],
  );

  const openMatch = (matchId: string, tab: CommandCenterTab = "score") => {
    setSelectedMatchId(matchId);
    setCommandTab(tab);
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
        actions={<OpsContextualCta cta={contextualCta} onAction={openMatch} />}
      />

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

      <div className="flex flex-col gap-4">
        <MatchQueueQuickFilters filters={filters} onChange={setFilters} />
        <MatchQueueAdvancedFilters
          filters={filters}
          onChange={setFilters}
          stages={stages.data ?? []}
          matches={matches.data ?? []}
        />
      </div>

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
          onPrimaryAction={(id) => openMatch(id, "score")}
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
        onOpenChange={(open) => !open && setSelectedMatchId(null)}
        defaultTab={commandTab}
      />
    </div>
  );
}
