"use client";

import type { PublicStageView } from "@tournament/api-client";
import { CalendarDays, MapPin, Trophy, Users } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicTournamentContext } from "@/features/public/components/public-tournament-provider";
import { divisionCapacityLabel, formatDateRange, isRegistrationOpen } from "@/features/public/config";
import { usePublicDivisions, usePublicStages } from "@/features/public/use-public-tournament";
import { getFormat, TOURNAMENT_STATUS } from "@/features/tournaments/config";

/**
 * The tournament landing page — overview, organizer, venue, schedule status,
 * divisions with registration status. Everything here is gated only by the
 * tournament's own visibility (already enforced by the layout resolving it at all);
 * competition data (bracket/fixtures/standings) lives on its own tabs, gated by
 * `drawPublishedAt` — see the backend `public.service` module.
 */
export function PublicOverview({ slug }: { slug: string }) {
  const { tournament } = usePublicTournamentContext();
  const divisions = usePublicDivisions(slug);
  const stages = usePublicStages(slug);

  const dateRange = formatDateRange(tournament.startsAt, tournament.endsAt);
  const status = TOURNAMENT_STATUS[tournament.status as keyof typeof TOURNAMENT_STATUS];
  const totalParticipants = (divisions.data ?? []).reduce((sum, d) => sum + d.approvedCount, 0);
  const stagesByDivision = new Map<string, PublicStageView[]>();
  for (const stage of stages.data ?? []) {
    stagesByDivision.set(stage.divisionId, [...(stagesByDivision.get(stage.divisionId) ?? []), stage]);
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.28em]">
            {tournament.sportKey}
            {dateRange ? ` · ${dateRange}` : ""}
          </p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
            {tournament.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
            <Badge tone="muted">
              <MapPin className="h-3 w-3" strokeWidth={2.5} />
              Venue TBA
            </Badge>
            <Badge tone="muted">
              <Users className="h-3 w-3" strokeWidth={2.5} />
              {totalParticipants} participants
            </Badge>
          </div>
        </div>
        {isRegistrationOpen(tournament.status) ? (
          <Button asChild tone="mint">
            <Link href={`/t/${slug}/register`}>Register</Link>
          </Button>
        ) : null}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Organizer</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-semibold">{tournament.organization.name}</p>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-2xl font-semibold tracking-tight">Divisions</h2>
        {divisions.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
        ) : (divisions.data?.length ?? 0) === 0 ? (
          <p className="text-muted-foreground text-sm">No divisions announced yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {divisions.data!.map((division) => {
              const divisionStages = stagesByDivision.get(division.id) ?? [];
              return (
                <Card key={division.id} hoverable>
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle className="text-lg">{division.name}</CardTitle>
                    {isRegistrationOpen(tournament.status) ? (
                      <Badge tone="candy">Registration open</Badge>
                    ) : null}
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <p className="text-muted-foreground text-sm">
                      {divisionCapacityLabel(division)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {divisionStages.map((stage) => (
                        <Badge key={stage.id} tone={stage.drawn ? "mint" : "muted"}>
                          <Trophy className="h-3 w-3" strokeWidth={2.5} />
                          {getFormat(stage.type)?.label ?? stage.type}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-2xl font-semibold tracking-tight">Schedule</h2>
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <CalendarDays className="text-muted-foreground h-5 w-5" strokeWidth={2.25} />
            {tournament.schedulePublishedAt ? (
              <p className="text-sm">
                See <Link href={`/t/${slug}/fixtures`} className="text-candy-dark font-semibold underline">Fixtures</Link> for match times and courts.
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">Detailed scheduling hasn&apos;t been published yet.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
