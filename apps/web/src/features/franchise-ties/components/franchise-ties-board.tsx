"use client";

import Link from "next/link";
import { Swords, Trophy } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import {
  useFranchiseTiesBoard,
  useGenerateFranchiseDraw,
  useGenerateFranchiseKnockoutDraw,
} from "@/features/franchise-ties/use-franchise-ties";
import { DrawPlanPreview } from "@/features/franchise-ties/components/draw-plan-preview";
import { PairingTierCheckBadge } from "@/features/franchise-ties/components/pairing-tier-check-badge";
import { SquadStandings } from "@/features/franchise-ties/components/squad-standings";
import { useDivisions, useStages } from "@/features/tournaments/use-tournaments";
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";
import { errorMessage } from "@/lib/problem";

const STATUS_TONE: Record<string, "mint" | "candy" | "yellow" | "muted"> = {
  completed: "mint",
  scheduled: "yellow",
  live: "candy",
};

export function FranchiseTiesBoard({
  tournamentId,
  stageId,
  mode = "round_robin",
  sourceStageId,
  advanceCount,
}: {
  tournamentId: string;
  stageId: string;
  mode?: "round_robin" | "knockout";
  sourceStageId?: string;
  advanceCount?: number;
}) {
  const can = useCan();
  const canManage = can(ACTIONS.TOURNAMENT_UPDATE);
  const board = useFranchiseTiesBoard(stageId);
  const generate = useGenerateFranchiseDraw(stageId, tournamentId);
  const generateKo = useGenerateFranchiseKnockoutDraw(stageId, tournamentId, sourceStageId);
  const isKnockout = mode === "knockout";

  const isPending = generate.isPending || generateKo.isPending;

  const onGenerate = () => {
    const mutation = isKnockout ? generateKo : generate;
    mutation.mutate(isKnockout ? advanceCount : undefined, {
      onSuccess: (res) =>
        toast.success(
          isKnockout
            ? `Created ${res.summary.ties} knockout matches`
            : `Created ${res.summary.ties} matches (${res.summary.legs} doubles legs)`,
        ),
      onError: (e) => toast.error(errorMessage(e, "Couldn't generate matches")),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {isPending && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border-border flex flex-col items-center gap-4 rounded-2xl border p-8 shadow-xl">
            <Spinner className="h-8 w-8" />
            <p className="text-foreground text-sm font-medium">Generating matches between teams…</p>
            <p className="text-muted-foreground text-xs">This may take a moment</p>
          </div>
        </div>
      )}
      <PageHeader
        eyebrow="Team draw"
        title={isKnockout ? "Knockout finals" : "Team matches"}
        description={
          isKnockout
            ? "Single-elimination team ties. Legs expand when both teams are known; winners advance to the next round."
            : "Team round robin. Each match is a series of doubles legs — score legs in Matches; the winning team is the one with more leg wins."
        }
        actions={
          canManage && board.data?.ties.length === 0 ? (
            <Button
              tone="mint"
              size="sm"
              onClick={onGenerate}
              loading={isPending}
              disabled={isPending}
            >
              <Trophy className="h-4 w-4" />
              {isKnockout ? "Generate Knockout Finals" : "Generate Matches"}
            </Button>
          ) : null
        }
      />

      {board.isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : board.isError ? (
        <ErrorState error={board.error} onRetry={() => board.refetch()} />
      ) : !board.data?.ties.length ? (
        <div className="flex flex-col gap-4">
          {/* Show the plan BEFORE committing — the draw runs once, and undoing it
              means clearing and rescheduling everything. */}
          {!isKnockout && <DrawPlanPreview tournamentId={tournamentId} />}
          {/* And confirm the pairs are tier-aligned before generating, so an
              off-sheet pair is caught here rather than on court. */}
          {!isKnockout && <PairingTierCheckBadge stageId={stageId} />}
          <EmptyState
            icon={Trophy}
            title={isKnockout ? "No knockout finals yet" : "No team draw yet"}
            description={
              isKnockout
                ? "Finish the round-robin stage, then generate single-elimination finals seeded from standings."
                : "Assign players to teams, publish doubles pairings for each team, then generate the draw."
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {board.data.ties.map((tie) => (
            <Card key={tie.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">
                    {tie.homeSquadName}{" "}
                    <span className="text-muted-foreground font-normal">vs</span>{" "}
                    {tie.awaySquadName}
                  </CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Legs won {tie.homeLegWins}–{tie.awayLegWins} (best of {tie.gamesPerTie})
                  </p>
                </div>
                <Badge tone={STATUS_TONE[tie.status] ?? "muted"} className="capitalize">
                  {tie.status}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {tie.legs.map((leg) => (
                  <div
                    key={leg.id}
                    className="border-ink/10 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
                  >
                    <span>
                      Leg {leg.legIndex + 1}: {leg.homePairName} vs {leg.awayPairName}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge tone={STATUS_TONE[leg.status] ?? "muted"} className="capitalize">
                        {leg.status}
                      </Badge>
                      <Button asChild tone="ghost" size="sm">
                        <Link href={`/console/tournaments/${tournamentId}/matches?match=${leg.id}`}>
                          <Swords className="h-3.5 w-3.5" />
                          Score
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function FranchiseTiesPage({ tournamentId }: { tournamentId: string }) {
  const divisions = useDivisions(tournamentId);
  const firstDivision = divisions.data?.[0];
  const stages = useStages(firstDivision?.id ?? "", { enabled: !!firstDivision?.id });
  const rrStage = stages.data?.find((s) => s.type === "round_robin") ?? stages.data?.[0];
  const koStage = stages.data?.find((s) => s.type === "single_elim" && s.id !== rrStage?.id);

  if (divisions.isLoading || stages.isLoading) return <Skeleton className="h-40 rounded-2xl" />;
  if (divisions.isError) {
    return <ErrorState error={divisions.error} onRetry={() => divisions.refetch()} />;
  }
  if (!firstDivision) {
    return (
      <EmptyState
        icon={Trophy}
        title="Add a division first"
        description="Create a division before generating franchise team ties."
      />
    );
  }
  if (stages.isError) {
    return <ErrorState error={stages.error} onRetry={() => stages.refetch()} />;
  }
  if (!rrStage) {
    return (
      <EmptyState
        icon={Trophy}
        title="Add a stage first"
        description="Create a division stage before generating franchise team ties."
      />
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <SquadStandings stageId={rrStage.id} />
      <FranchiseTiesBoard tournamentId={tournamentId} stageId={rrStage.id} mode="round_robin" />
      {koStage ? (
        <FranchiseTiesBoard
          tournamentId={tournamentId}
          stageId={koStage.id}
          mode="knockout"
          sourceStageId={rrStage.id}
          advanceCount={4}
        />
      ) : null}
    </div>
  );
}
