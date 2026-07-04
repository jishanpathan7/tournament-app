"use client";

import { Calendar, Clock, ExternalLink, History, Trophy, UserCheck } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { matchStatusMeta } from "@/features/draws/config";
import { usePortalHome } from "@/features/portal/use-portal";

const STATUS_TONE: Record<string, "mint" | "candy" | "pink" | "yellow" | "muted"> = {
  approved: "mint",
  submitted: "yellow",
  waitlisted: "candy",
  rejected: "pink",
  checked_in: "mint",
  pending: "yellow",
  absent: "pink",
};

function StatusBadge({ label }: { label: string }) {
  const tone = STATUS_TONE[label] ?? "muted";
  return (
    <Badge tone={tone} className="capitalize">
      {label.replace(/_/g, " ")}
    </Badge>
  );
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "Time TBD";
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function MatchRow({
  match,
  showOrg,
}: {
  match: {
    id: string;
    status: string;
    opponentLabel: string;
    tournamentName: string;
    tournamentSlug: string;
    divisionName: string;
    organizationName: string;
    roundLabel: string | null;
    scheduledAt: string | null;
    scoreSummary: string | null;
  };
  showOrg: boolean;
}) {
  const status = matchStatusMeta(match.status);
  return (
    <div className="border-ink/10 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-semibold">
          vs {match.opponentLabel}
          {match.scoreSummary ? (
            <span className="text-muted-foreground ml-2 font-mono text-sm">{match.scoreSummary}</span>
          ) : null}
        </p>
        <p className="text-muted-foreground text-sm">
          {match.tournamentName} · {match.divisionName}
          {showOrg ? ` · ${match.organizationName}` : ""}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          {match.roundLabel ?? "Match"} · {formatWhen(match.scheduledAt)}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Badge tone={status.tone} className="capitalize">
          {status.label}
        </Badge>
        {match.tournamentSlug ? (
          <Button asChild tone="paper" size="sm">
            <Link href={`/t/${match.tournamentSlug}/matches/${match.id}`}>
              <ExternalLink className="h-4 w-4" />
              View
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function PortalHome() {
  const portal = usePortalHome();
  const data = portal.data;
  const showOrg =
    new Set([
      ...(data?.registrations.map((r) => r.organizationId) ?? []),
      ...(data?.participations.map((p) => p.organizationId) ?? []),
    ]).size > 1;

  const hasContent =
    !!data?.registrations.length ||
    !!data?.participations.length ||
    !!data?.upcomingMatches.length ||
    !!data?.recentMatches.length;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Player"
        title="My tournaments"
        description="Your schedule, registrations, and match history across every organization you're in."
      />

      {portal.isLoading ? (
        <div className="grid gap-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      ) : portal.isError ? (
        <ErrorState error={portal.error} onRetry={() => portal.refetch()} />
      ) : !hasContent ? (
        <EmptyState
          icon={Trophy}
          title="Nothing here yet"
          description="Register for a tournament or ask your organizer to link your account to a team."
        />
      ) : (
        <div className="grid gap-6">
          {data!.upcomingMatches.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5" strokeWidth={2.25} />
                  Upcoming matches
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {data!.upcomingMatches.map((m) => (
                  <MatchRow key={m.id} match={m} showOrg={showOrg} />
                ))}
              </CardContent>
            </Card>
          ) : null}

          {data!.recentMatches.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="h-5 w-5" strokeWidth={2.25} />
                  Recent results
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {data!.recentMatches.map((m) => (
                  <MatchRow key={m.id} match={m} showOrg={showOrg} />
                ))}
              </CardContent>
            </Card>
          ) : null}

          {data!.participations.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <UserCheck className="h-5 w-5" strokeWidth={2.25} />
                  Active participations
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {data!.participations.map((p) => (
                  <div
                    key={p.id}
                    className="border-ink/10 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">{p.displayName}</p>
                      <p className="text-muted-foreground text-sm">
                        {p.tournamentName} · {p.divisionName}
                        {showOrg ? ` · ${p.organizationName}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <StatusBadge label={p.status} />
                        <StatusBadge label={p.attendance} />
                      </div>
                    </div>
                    {p.tournamentSlug ? (
                      <Button asChild tone="paper" size="sm" className="shrink-0">
                        <Link href={`/t/${p.tournamentSlug}`}>
                          <ExternalLink className="h-4 w-4" />
                          Public site
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {data!.registrations.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calendar className="h-5 w-5" strokeWidth={2.25} />
                  My registrations
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {data!.registrations.map((r) => (
                  <div
                    key={r.id}
                    className="border-ink/10 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">{r.tournamentName}</p>
                      <p className="text-muted-foreground text-sm">
                        {r.divisionName}
                        {showOrg ? ` · ${r.organizationName}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <StatusBadge label={r.status} />
                        {r.skillLevel ? (
                          <Badge tone="muted" className="capitalize">
                            {r.skillLevel}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    {r.tournamentSlug ? (
                      <Button asChild tone="paper" size="sm" className="shrink-0">
                        <Link href={`/t/${r.tournamentSlug}`}>
                          <ExternalLink className="h-4 w-4" />
                          Public site
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
