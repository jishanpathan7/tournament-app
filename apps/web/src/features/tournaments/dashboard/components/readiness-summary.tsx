"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { TournamentReadinessView } from "@tournament/api-client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ErrorState } from "@/components/common/error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ReadinessRow } from "@/features/registration-ops/components/readiness-row";

export function ReadinessSummary({
  tournamentId,
  readiness,
}: {
  tournamentId: string;
  readiness: UseQueryResult<TournamentReadinessView>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-lg">Readiness</CardTitle>
        <Button asChild tone="ghost" size="sm">
          <Link href={`/console/tournaments/${tournamentId}/readiness`}>
            Full view
            <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {readiness.isLoading ? (
          <>
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </>
        ) : readiness.isError ? (
          <ErrorState error={readiness.error} onRetry={() => readiness.refetch()} />
        ) : (
          readiness.data?.divisions.map((div) => (
            <ReadinessRow key={div.divisionId} view={div} tournamentId={tournamentId} compact />
          ))
        )}
      </CardContent>
    </Card>
  );
}
