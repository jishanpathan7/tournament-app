"use client";

import type { StageResponse } from "@tournament/api-client";
import { CheckCircle2, ChevronRight, Circle } from "lucide-react";
import Link from "next/link";

import { ErrorState } from "@/components/common/error-state";
import { LoadingPanel } from "@/components/common/loading";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FranchiseTiesPage } from "@/features/franchise-ties/components/franchise-ties-board";
import { useSquads } from "@/features/squads/use-squads";
import { useDivisions, useStages } from "@/features/tournaments/use-tournaments";

function StageRow({
  tournamentId,
  divisionId,
  stage,
}: {
  tournamentId: string;
  divisionId: string;
  stage: StageResponse;
}) {
  const href = `/console/tournaments/${tournamentId}/divisions/${divisionId}/stages/${stage.id}/draw`;
  const typeLabel =
    stage.type === "single_elimination"
      ? "Knockout"
      : stage.type === "round_robin"
        ? "Round Robin"
        : stage.type;

  return (
    <Link
      href={href}
      className="border-border hover:bg-muted/50 flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors"
    >
      {stage.drawn ? (
        <CheckCircle2 className="text-mint-dark h-4 w-4 shrink-0" strokeWidth={2.25} />
      ) : (
        <Circle className="text-muted-foreground h-4 w-4 shrink-0" strokeWidth={2.25} />
      )}
      <div className="flex flex-1 items-center gap-2 overflow-hidden">
        <span className="truncate text-sm font-semibold">{typeLabel}</span>
        <Badge tone={stage.type === "single_elimination" ? "candy" : "mint"} className="text-2xs">
          {typeLabel}
        </Badge>
        {stage.drawn ? (
          <Badge tone="mint" className="text-2xs">
            Drawn
          </Badge>
        ) : (
          <Badge tone="muted" className="text-2xs">
            Not drawn
          </Badge>
        )}
      </div>
      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" strokeWidth={2.25} />
    </Link>
  );
}

function DivisionDrawCard({
  tournamentId,
  divisionId,
  divisionName,
}: {
  tournamentId: string;
  divisionId: string;
  divisionName: string;
}) {
  const { data: stages, isLoading } = useStages(divisionId);

  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-muted-foreground text-2xs mb-3 font-mono font-semibold uppercase tracking-[0.18em]">
          {divisionName}
        </p>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading stages…</p>
        ) : !stages || stages.length === 0 ? (
          <p className="text-muted-foreground text-sm">No stages configured for this division.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {stages.map((stage) => (
              <StageRow
                key={stage.id}
                tournamentId={tournamentId}
                divisionId={divisionId}
                stage={stage}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DrawsIndex({ tournamentId }: { tournamentId: string }) {
  const { data: divisions, isLoading, isError, refetch } = useDivisions(tournamentId);
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
        title="Draws"
        description="Generate and review the bracket or round-robin draw for each division."
      />
      {!divisions || divisions.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No divisions found. Create divisions first before generating draws.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {divisions.map((division) => (
            <DivisionDrawCard
              key={division.id}
              tournamentId={tournamentId}
              divisionId={division.id}
              divisionName={division.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}
