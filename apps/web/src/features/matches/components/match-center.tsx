"use client";

import { ArrowLeft, Swords } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityTimeline } from "@/features/matches/components/activity-timeline";
import { MatchDetailDialog } from "@/features/matches/components/match-detail-dialog";
import { MatchQueueFiltersBar } from "@/features/matches/components/match-queue-filters-bar";
import { MatchQueueTable } from "@/features/matches/components/match-queue-table";
import {
  applyMatchQueueFilters,
  countByStatus,
  DEFAULT_MATCH_QUEUE_FILTERS,
} from "@/features/matches/config";
import {
  useTournamentMatches,
  useTournamentParticipants,
  useTournamentStages,
} from "@/features/matches/use-tournament-matches";
import { useTournament } from "@/features/tournaments/use-tournaments";
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";
import { ApiError } from "@/lib/problem";
import { MATCH_STATUS } from "@/features/draws/config";

/**
 * The Match Center: a tournament-wide queue of every match, filterable by stage/round/
 * group/court/status, plus a tournament-wide activity feed. Selecting a match opens its
 * detail (participants, context, score entry, history). Realtime + query invalidation
 * keep everything current without a manual refresh — see `hooks/use-realtime.ts`.
 */
export function MatchCenter({ tournamentId }: { tournamentId: string }) {
  const can = useCan();
  const canManage = can(ACTIONS.SCORING_WRITE);

  const tournament = useTournament(tournamentId);
  const matches = useTournamentMatches(tournamentId);
  const stages = useTournamentStages(tournamentId);
  const participants = useTournamentParticipants(tournamentId);

  const [filters, setFilters] = useState(DEFAULT_MATCH_QUEUE_FILTERS);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  const participantsById = useMemo(
    () => new Map((participants.data ?? []).map((p) => [p.id, p])),
    [participants.data],
  );
  const stagesById = useMemo(() => new Map((stages.data ?? []).map((s) => [s.id, s])), [stages.data]);

  const filtered = useMemo(
    () => applyMatchQueueFilters(matches.data ?? [], filters, participantsById),
    [matches.data, filters, participantsById],
  );
  // Derived fresh from the live query every render (not a frozen snapshot) so scoring a
  // match updates this dialog in place instead of showing stale data until it's closed.
  const selectedMatch = matches.data?.find((m) => m.id === selectedMatchId) ?? null;
  const counts = useMemo(() => countByStatus(matches.data ?? []), [matches.data]);

  if (tournament.isLoading || matches.isLoading || stages.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-40 border-0" />
        <Skeleton className="h-24 rounded-2xl" />
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
    <div className="flex flex-col gap-6">
      <Button asChild tone="ghost" size="sm" className="text-muted-foreground -ml-2 self-start">
        <Link href={`/console/tournaments/${tournamentId}`}>
          <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
          Back to tournament
        </Link>
      </Button>

      <PageHeader
        eyebrow="Match Center"
        title={tournament.data.name}
        description="Live scoring and match operations for the whole tournament."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {Object.entries(counts).map(([status, count]) => (
              <Badge key={status} tone={MATCH_STATUS[status]?.tone ?? "muted"}>
                {count} {MATCH_STATUS[status]?.label ?? status}
              </Badge>
            ))}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <MatchQueueFiltersBar
            filters={filters}
            onChange={setFilters}
            stages={stages.data ?? []}
            matches={matches.data ?? []}
          />

          {matches.isError ? (
            <ErrorState error={matches.error} onRetry={() => matches.refetch()} title="Couldn't load matches" />
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
            <MatchQueueTable
              matches={filtered}
              participantsById={participantsById}
              stagesById={stagesById}
              onOpen={setSelectedMatchId}
            />
          )}
        </div>

        <ActivityTimeline tournamentId={tournamentId} />
      </div>

      <MatchDetailDialog
        match={selectedMatch}
        tournamentId={tournamentId}
        tournamentName={tournament.data.name}
        stagesById={stagesById}
        participantsById={participantsById}
        canManage={canManage}
        open={!!selectedMatch}
        onOpenChange={(open) => !open && setSelectedMatchId(null)}
      />
    </div>
  );
}
