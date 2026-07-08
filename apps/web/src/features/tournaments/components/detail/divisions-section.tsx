"use client";

import { CheckSquare, LayoutGrid, Pencil, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { RegistrationsSummaryLink } from "@/features/registrations/components/registrations-summary-link";
import { EditDivisionDialog } from "@/features/tournaments/components/detail/edit-division-dialog";
import { StagesList } from "@/features/tournaments/components/detail/stages-list";
import { PARTICIPANT_KINDS } from "@/features/tournaments/config";
import { useDivisions } from "@/features/tournaments/use-tournaments";

/** Divisions with their stages/draw status + a registrations/capacity summary link. */
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
          title="No event types"
          description="This tournament has no events configured yet."
          className="py-12"
        />
      </Card>
    );
  }

  return <DivisionList tournamentId={tournamentId} divisions={data} canManage={canManage} />;
}

import type { DivisionResponse } from "@tournament/api-client";

function DivisionList({
  tournamentId,
  divisions,
  canManage,
}: {
  tournamentId: string;
  divisions: DivisionResponse[];
  canManage: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingDivision = divisions.find((d) => d.id === editingId) ?? null;

  return (
    <>
      <div className="flex flex-col gap-4">
        {divisions.map((division) => (
          <Card key={division.id}>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-lg">{division.name}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge tone="candy">
                  {PARTICIPANT_KINDS[division.participantType as keyof typeof PARTICIPANT_KINDS] ??
                    division.participantType}
                </Badge>
                {canManage ? (
                  <Button
                    tone="paper"
                    size="sm"
                    onClick={() => setEditingId(division.id)}
                    aria-label="Edit division"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <StagesList tournamentId={tournamentId} divisionId={division.id} />
              <Separator />
              <RegistrationsSummaryLink
                tournamentId={tournamentId}
                divisionId={division.id}
                capacity={division.capacity}
                canManage={canManage}
              />
              {canManage ? (
                <div className="flex flex-wrap gap-2">
                  <Button tone="paper" size="sm" asChild>
                    <Link
                      href={`/console/tournaments/${tournamentId}/divisions/${division.id}/import`}
                    >
                      <Upload className="h-4 w-4" strokeWidth={2.25} /> Import CSV
                    </Link>
                  </Button>
                  <Button tone="paper" size="sm" asChild>
                    <Link
                      href={`/console/tournaments/${tournamentId}/divisions/${division.id}/attendance`}
                    >
                      <CheckSquare className="h-4 w-4" strokeWidth={2.25} /> Check-in
                    </Link>
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
      {editingDivision ? (
        <EditDivisionDialog
          tournamentId={tournamentId}
          division={editingDivision}
          open={editingId !== null}
          onOpenChange={(open) => {
            if (!open) setEditingId(null);
          }}
        />
      ) : null}
    </>
  );
}
