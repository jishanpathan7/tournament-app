"use client";

import { LayoutGrid } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { RegistrationsPanel } from "@/features/tournaments/components/detail/registrations-panel";
import { StagesList } from "@/features/tournaments/components/detail/stages-list";
import { PARTICIPANT_KINDS } from "@/features/tournaments/config";
import { useDivisions } from "@/features/tournaments/use-tournaments";

/** Divisions with their stages/draw status + registrations & participants. */
export function DivisionsSection({
  tournamentId,
  canManage,
}: {
  tournamentId: string;
  canManage: boolean;
}) {
  const { data, isLoading, isError, error, refetch } = useDivisions(tournamentId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }
  if (isError)
    return <ErrorState error={error} onRetry={() => refetch()} title="Couldn't load divisions" />;
  if (!data || data.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={LayoutGrid}
          title="No divisions"
          description="This tournament has no divisions configured."
          className="py-12"
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {data.map((division) => (
        <Card key={division.id}>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-lg">{division.name}</CardTitle>
            <Badge tone="candy">
              {PARTICIPANT_KINDS[division.participantType as keyof typeof PARTICIPANT_KINDS] ??
                division.participantType}
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <StagesList divisionId={division.id} canManage={canManage} />
            <Separator />
            <RegistrationsPanel divisionId={division.id} canManage={canManage} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
