"use client";

import { Calendar, GitMerge, LayoutGrid, MapPin, Users } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTournamentCourts } from "@/features/courts/use-courts";
import {
  useTournamentMatches,
  useTournamentStages,
} from "@/features/matches/use-tournament-matches";

function HubCard({
  icon: Icon,
  title,
  description,
  badge,
  href,
  loading,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  badge?: { label: string; tone: "mint" | "muted" | "candy" | "yellow" };
  href: string;
  loading?: boolean;
}) {
  return (
    <Link href={href} className="block">
      <Card className="hover:border-ink h-full transition-colors">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            <span className="flex items-center gap-2">
              <Icon className="text-muted-foreground h-4 w-4" strokeWidth={2.25} />
              {title}
            </span>
            {loading ? (
              <Skeleton className="h-5 w-16 rounded-full" />
            ) : badge ? (
              <Badge tone={badge.tone}>{badge.label}</Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function SetupHub({ tournamentId }: { tournamentId: string }) {
  const base = `/console/tournaments/${tournamentId}`;

  const stages = useTournamentStages(tournamentId);
  const courts = useTournamentCourts(tournamentId);
  const matches = useTournamentMatches(tournamentId);

  const isLoading = stages.isLoading || courts.isLoading || matches.isLoading;

  const stageCount = stages.data?.length ?? 0;
  const drawnCount = stages.data?.filter((s) => s.drawn).length ?? 0;
  const courtCount = courts.data?.length ?? 0;
  const matchCount = matches.data?.length ?? 0;

  const drawBadge =
    stageCount === 0
      ? { label: "No stages", tone: "muted" as const }
      : drawnCount === stageCount
        ? { label: `${drawnCount}/${stageCount} built`, tone: "mint" as const }
        : { label: `${drawnCount}/${stageCount} built`, tone: "muted" as const };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <HubCard
        icon={Users}
        title="Players"
        description="Import, approve, and check in participants."
        href={`${base}/players`}
      />
      <HubCard
        icon={GitMerge}
        title="Draws"
        description="Generate brackets and group stage draws."
        badge={drawBadge}
        loading={isLoading}
        href={`${base}/draws`}
      />
      <HubCard
        icon={MapPin}
        title="Courts"
        description="Assign venues where matches will be played."
        badge={
          courtCount > 0
            ? { label: `${courtCount} court${courtCount !== 1 ? "s" : ""}`, tone: "mint" }
            : { label: "None yet", tone: "muted" }
        }
        loading={isLoading}
        href={`${base}/courts`}
      />
      <HubCard
        icon={Calendar}
        title="Schedule"
        description="Time-slot matches across courts."
        badge={
          matchCount > 0
            ? { label: `${matchCount} match${matchCount !== 1 ? "es" : ""}`, tone: "mint" }
            : { label: "Not scheduled", tone: "muted" }
        }
        loading={isLoading}
        href={`${base}/schedule`}
      />
      <HubCard
        icon={LayoutGrid}
        title="Teams"
        description="Manage franchise teams and run the draft ceremony — for team-format events."
        href={`${base}/teams`}
      />
    </div>
  );
}
