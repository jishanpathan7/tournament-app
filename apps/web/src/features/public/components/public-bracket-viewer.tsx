"use client";

import { Network } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicBracketBoard } from "@/features/public/components/public-bracket-board";
import { PublicRoundRobinFixtures } from "@/features/public/components/public-round-robin-fixtures";
import {
  usePublicDivisions,
  usePublicMatches,
  usePublicParticipants,
  usePublicStages,
} from "@/features/public/use-public-tournament";
import { getFormat } from "@/features/tournaments/config";

/** Picks a stage/division (when there's more than one) and renders the right board
 * for its format — single elimination gets the tree view, everything else gets
 * grouped fixtures. Supports both formats named in the spec from one page. */
export function PublicBracketViewer({ slug }: { slug: string }) {
  const divisions = usePublicDivisions(slug);
  const stages = usePublicStages(slug);
  const matches = usePublicMatches(slug);
  const participants = usePublicParticipants(slug);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  const divisionsById = useMemo(
    () => new Map((divisions.data ?? []).map((d) => [d.id, d])),
    [divisions.data],
  );
  const participantsById = useMemo(
    () => new Map((participants.data ?? []).map((p) => [p.id, p])),
    [participants.data],
  );
  const drawnStages = (stages.data ?? []).filter((s) => s.drawn);
  const activeStage = drawnStages.find((s) => s.id === selectedStageId) ?? drawnStages[0] ?? null;
  const stageMatches = useMemo(
    () => (matches.data ?? []).filter((m) => m.stageId === activeStage?.id),
    [matches.data, activeStage],
  );

  const loading = divisions.isLoading || stages.isLoading || matches.isLoading || participants.isLoading;

  if (loading) {
    return <Skeleton className="h-96 rounded-2xl" />;
  }
  if (matches.isError) {
    return <ErrorState error={matches.error} onRetry={() => matches.refetch()} />;
  }
  if (drawnStages.length === 0) {
    return (
      <EmptyState
        icon={Network}
        title="No bracket yet"
        description="The draw hasn't been published for this tournament yet."
        className="py-16"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {drawnStages.length > 1 ? (
        <Select value={activeStage?.id} onValueChange={setSelectedStageId}>
          <SelectTrigger className="w-64" aria-label="Choose a division">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {drawnStages.map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>
                {divisionsById.get(stage.divisionId)?.name ?? "Division"} ·{" "}
                {getFormat(stage.type)?.label ?? stage.type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {activeStage?.type === "single_elim" ? (
        <PublicBracketBoard slug={slug} matches={stageMatches} participantsById={participantsById} />
      ) : (
        <PublicRoundRobinFixtures slug={slug} matches={stageMatches} participantsById={participantsById} />
      )}
    </div>
  );
}
