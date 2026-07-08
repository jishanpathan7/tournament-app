"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Stepper } from "@/components/ui/stepper";
import type { WorkflowState } from "@/features/squads/config";

const WORKFLOW_STEPS = [
  "Teams Created",
  "Players Assigned",
  "Teams Paired",
  "Ready to Draw",
] as const;

export function WorkflowProgress({
  workflow,
  tournamentId,
  assigned,
  onNextAction,
}: {
  workflow: WorkflowState;
  tournamentId: string;
  assigned: number;
  onNextAction?: () => void;
}) {
  const { currentStep, pairedCount, totalSquads, nextSquad } = workflow;

  return (
    <Card className="bg-muted/30">
      <CardContent className="flex flex-col gap-4 p-4">
        <Stepper steps={[...WORKFLOW_STEPS]} current={currentStep} />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              <strong>{totalSquads}</strong> teams
            </span>
            <span className="text-muted-foreground">·</span>
            <span>
              <strong>{assigned}</strong> assigned
            </span>
            {workflow.playersAssigned && (
              <>
                <span className="text-muted-foreground">·</span>
                <span>
                  <strong>{pairedCount}</strong>/{totalSquads} teams paired
                </span>
              </>
            )}
            {!workflow.playersAssigned && <Badge tone="yellow">Assign players first</Badge>}
            {workflow.playersAssigned && !workflow.teamsPaired && (
              <Badge tone="yellow">
                {totalSquads - pairedCount} team{totalSquads - pairedCount !== 1 ? "s" : ""}{" "}
                remaining
              </Badge>
            )}
            {workflow.readyForDraw && <Badge tone="mint">All pairs locked</Badge>}
          </div>

          {workflow.readyForDraw ? (
            <Button asChild tone="mint" size="sm">
              <Link href={`/console/tournaments/${tournamentId}/draws`}>
                Generate Matches
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : nextSquad && onNextAction ? (
            <Button tone="candy" size="sm" onClick={onNextAction}>
              Generate pairs for {nextSquad.name}
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
