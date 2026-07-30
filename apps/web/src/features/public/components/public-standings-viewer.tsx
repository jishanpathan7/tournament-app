"use client";

import { BarChart3 } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicStandingsTable } from "@/features/public/components/public-standings-table";
import { usePublicDivisions, usePublicStages } from "@/features/public/use-public-tournament";
import { getFormat } from "@/features/tournaments/config";

/** Picks a stage (when there's more than one) and shows its standings table. */
export function PublicStandingsViewer({ slug }: { slug: string }) {
  const divisions = usePublicDivisions(slug);
  const stages = usePublicStages(slug);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  const divisionsById = useMemo(
    () => new Map((divisions.data ?? []).map((d) => [d.id, d])),
    [divisions.data],
  );
  const drawnStages = (stages.data ?? []).filter((s) => s.drawn);
  const activeStage = drawnStages.find((s) => s.id === selectedStageId) ?? drawnStages[0] ?? null;

  if (divisions.isLoading || stages.isLoading) {
    return <Skeleton className="h-64 rounded-2xl" />;
  }
  if (drawnStages.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No standings yet"
        description="Standings appear once the draw is published and matches are played."
        className="py-16"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {drawnStages.length > 1 ? (
        <Select value={activeStage?.id} onValueChange={setSelectedStageId}>
          <SelectTrigger className="w-full sm:w-64" aria-label="Choose a division">
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
      {activeStage ? <PublicStandingsTable slug={slug} stageId={activeStage.id} /> : null}
    </div>
  );
}
