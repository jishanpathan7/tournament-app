"use client";

import { GitMerge, Layers } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingPanel } from "@/components/common/loading";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FranchiseTiesPage } from "@/features/franchise-ties/components/franchise-ties-board";
import { useMemo } from "react";

import { useSquads } from "@/features/squads/use-squads";
import { useParticipants } from "@/features/registrations/use-registrations";
import { DrawSetupPanel } from "@/features/draws/components/draw-setup-panel";
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";
import { useDivisions, useStages, useTournament } from "@/features/tournaments/use-tournaments";

function DivisionDrawCard({
  tournamentId,
  divisionId,
  divisionName,
  participantType,
  tournamentSlug,
}: {
  tournamentId: string;
  divisionId: string;
  divisionName: string;
  participantType?: string;
  tournamentSlug?: string;
}) {
  const { data: stages, isLoading } = useStages(divisionId);
  const participants = useParticipants(divisionId);
  const can = useCan();
  const canManage = can(ACTIONS.TOURNAMENT_UPDATE);
  // Count only the entrants this division actually fields. The same people exist as
  // individuals, as pairs, and as squads at once, so counting every approved row shows
  // an inflated figure — 92 for a 58-player, 4-team tournament.
  const approvedCount = useMemo(
    () =>
      (participants.data ?? []).filter(
        (p) => p.status === "approved" && (!participantType || p.kind === participantType),
      ).length,
    [participants.data, participantType],
  );

  // No outer Card: DrawSetupPanel is a Card itself, so wrapping would nest them.
  return (
    <section className="flex flex-col gap-2">
      <p className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.18em]">
        {divisionName}
      </p>
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading stages…</p>
      ) : !stages || stages.length === 0 ? (
        <Card>
          <CardContent className="pt-4">
            <EmptyState
              icon={Layers}
              title="No stages"
              description="Add stages to this division in Setup to generate a draw."
              action={
                <Button asChild tone="paper" size="sm">
                  <Link href={`/console/tournaments/${tournamentId}/setup`}>Go to Setup →</Link>
                </Button>
              }
              className="py-6"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {stages.map((stage) => (
            <DrawSetupPanel
              key={stage.id}
              stage={stage}
              divisionId={divisionId}
              tournamentId={tournamentId}
              approvedCount={approvedCount}
              canManage={canManage}
              tournamentSlug={tournamentSlug}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function DrawsIndex({ tournamentId }: { tournamentId: string }) {
  const { data: divisions, isLoading, isError, refetch } = useDivisions(tournamentId);
  const tournament = useTournament(tournamentId);
  const squads = useSquads(tournamentId);
  const isTeamFormat = (squads.data?.summary.squadCount ?? 0) > 0;

  if (isLoading || squads.isLoading) return <LoadingPanel label="Loading draws" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  // Team format: primary section is the team draw (squad round-robin + knockout).
  // Standard division draw stages are still shown below for reference.
  if (isTeamFormat) {
    return (
      <div className="flex flex-col gap-10">
        <FranchiseTiesPage tournamentId={tournamentId} />
        {divisions && divisions.length > 0 && (
          <section className="flex flex-col gap-4">
            <p className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.18em]">
              Division stages
            </p>
            {divisions.map((division) => (
              <DivisionDrawCard
                key={division.id}
                tournamentId={tournamentId}
                divisionId={division.id}
                divisionName={division.name}
                participantType={division.participantType}
                tournamentSlug={tournament.data?.slug}
              />
            ))}
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Tournament"
        title="Brackets"
        description="Generate and review the bracket or round-robin draw for each division."
      />
      {!divisions || divisions.length === 0 ? (
        <EmptyState
          icon={GitMerge}
          title="No divisions yet"
          description="Create at least one division in Setup before generating draws."
          action={
            <Button asChild tone="paper" size="sm">
              <Link href={`/console/tournaments/${tournamentId}/setup`}>Go to Setup →</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {divisions.map((division) => (
            <DivisionDrawCard
              key={division.id}
              tournamentId={tournamentId}
              divisionId={division.id}
              divisionName={division.name}
              participantType={division.participantType}
              tournamentSlug={tournament.data?.slug}
            />
          ))}
        </div>
      )}
    </div>
  );
}
