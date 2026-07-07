"use client";

import { LayoutGrid } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicCourts } from "@/features/public/use-public-tournament";
import type { PublicCourtMatchView } from "@/features/public/public-api";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<string, "mint" | "candy" | "yellow" | "muted"> = {
  completed: "mint",
  live: "candy",
  scheduled: "yellow",
};

function MatchChip({ match, label }: { match: PublicCourtMatchView | null; label: string }) {
  if (!match) return null;
  const names = match.sides.map((s) => s.participantId).join(" vs ");
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground font-mono text-xs uppercase tracking-widest">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <Badge tone={STATUS_TONE[match.status] ?? "muted"} className="capitalize">
          {match.status}
        </Badge>
        <span className="text-sm font-semibold">{names || "TBD vs TBD"}</span>
      </div>
    </div>
  );
}

export function PublicCourtsView({ slug }: { slug: string }) {
  const { data, isLoading, isError, error, refetch } = usePublicCourts(slug);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data || data.courts.length === 0) {
    return (
      <EmptyState
        icon={LayoutGrid}
        title="No courts set up"
        description="Courts will appear here once the organizer assigns matches to courts."
        className="py-16"
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.courts.map((c) => {
          const isLive = c.currentMatch?.status === "live";
          const isFree = !c.currentMatch && !c.nextMatch;
          return (
            <Card
              key={c.court.id}
              className={cn(
                "border-2",
                isLive && "border-candy bg-candy-tint",
                isFree && "opacity-60",
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{c.court.name}</CardTitle>
                  <Badge tone={isLive ? "candy" : isFree ? "muted" : "yellow"}>
                    {isLive ? "In play" : isFree ? "Free" : "Up next"}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-xs">{c.court.venueName}</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <MatchChip match={c.currentMatch} label="Now" />
                <MatchChip match={c.nextMatch} label="Next" />
                {!c.currentMatch && !c.nextMatch ? (
                  <p className="text-muted-foreground text-sm">No match scheduled</p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {data.unscheduled.length > 0 ? (
        <div>
          <h2 className="mb-3 font-serif text-lg font-semibold">Waiting for court</h2>
          <div className="flex flex-col gap-2">
            {data.unscheduled.map((m) => (
              <div
                key={m.id}
                className="border-ink/10 flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm"
              >
                <span className="font-semibold">
                  {m.sides.map((s) => s.participantId).join(" vs ") || "TBD vs TBD"}
                </span>
                <Badge tone="yellow">Queued</Badge>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
