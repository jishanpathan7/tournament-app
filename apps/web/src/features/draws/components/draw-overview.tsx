"use client";

import { ArrowLeft, GitMerge } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BracketBoard } from "@/features/draws/components/bracket-board";
import { DrawSetupPanel } from "@/features/draws/components/draw-setup-panel";
import { DrawStatusBadges } from "@/features/draws/components/draw-status-badges";
import { RoundRobinBoard } from "@/features/draws/components/round-robin-board";
import { useParticipants } from "@/features/registrations/use-registrations";
import { useStageMatches, useStandings } from "@/features/scoring/use-matches";
import { getFormat } from "@/features/tournaments/config";
import { useDivisions, useStages, useTournament } from "@/features/tournaments/use-tournaments";
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";
import { ApiError } from "@/lib/problem";

export function DrawOverview({
  tournamentId,
  divisionId,
  stageId,
}: {
  tournamentId: string;
  divisionId: string;
  stageId: string;
}) {
  const can = useCan();
  const canManage = can(ACTIONS.TOURNAMENT_UPDATE);

  const tournament = useTournament(tournamentId);
  const divisions = useDivisions(tournamentId);
  const stages = useStages(divisionId);
  const participants = useParticipants(divisionId);

  const division = divisions.data?.find((d) => d.id === divisionId) ?? null;
  const stage = stages.data?.find((s) => s.id === stageId) ?? null;

  const approvedCount = useMemo(
    () => (participants.data ?? []).filter((p) => p.status === "approved").length,
    [participants.data],
  );
  const participantsById = useMemo(
    () => new Map((participants.data ?? []).map((p) => [p.id, p])),
    [participants.data],
  );

  const matchesQuery = useStageMatches(stageId, { enabled: !!stage?.drawn });
  const matches = {
    ...matchesQuery,
    data: matchesQuery.data?.filter((m) => m.contestKind !== "tie"),
  };
  const standings = useStandings(stageId, {
    enabled: !!stage?.drawn && stage?.type === "round_robin",
  });

  const loading = tournament.isLoading || divisions.isLoading || stages.isLoading;
  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-40 border-0" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
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

  if (!stage) {
    return (
      <ErrorState error={stages.error} onRetry={() => stages.refetch()} title="Stage not found" />
    );
  }

  const format = getFormat(stage.type);

  return (
    <div className="flex flex-col gap-6">
      <Button asChild tone="ghost" size="sm" className="text-muted-foreground -ml-2 self-start">
        <Link href={`/console/tournaments/${tournamentId}`}>
          <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
          Back to tournament
        </Link>
      </Button>

      <PageHeader
        eyebrow="Draw & bracket management"
        title={division?.name ?? "Brackets"}
        description={`${format?.label ?? stage.type} · Stage ${stage.seq + 1}`}
        actions={<DrawStatusBadges stage={stage} tournament={tournament.data} />}
      />

      <DrawSetupPanel
        stage={stage}
        divisionId={divisionId}
        tournamentId={tournament.data.id}
        approvedCount={approvedCount}
        canManage={canManage}
        tournamentSlug={tournament.data.slug}
      />

      {!stage.drawn ? (
        <EmptyState
          icon={GitMerge}
          title="No draw yet"
          description="Once you generate the draw, matches, rounds, and (for knockouts) the bracket will show up here."
          className="py-14"
        />
      ) : matches.isLoading || participants.isLoading ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : matches.isError ? (
        <ErrorState
          error={matches.error}
          onRetry={() => matches.refetch()}
          title="Couldn't load matches"
        />
      ) : (matches.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={GitMerge}
          title="No matches"
          description="This draw has no matches yet."
        />
      ) : stage.type === "single_elim" ? (
        <BracketBoard matches={matches.data!} participantsById={participantsById} />
      ) : (
        <RoundRobinBoard
          matches={matches.data!}
          participantsById={participantsById}
          standings={standings.data}
        />
      )}
    </div>
  );
}
