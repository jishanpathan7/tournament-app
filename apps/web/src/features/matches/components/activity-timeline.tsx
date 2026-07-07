"use client";

import { Activity } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { activityActionLabel } from "@/features/matches/config";
import { useTournamentActivity } from "@/features/matches/use-tournament-matches";

/** Tournament-wide feed: score submissions, corrections, draw generation, and other
 * lifecycle events — everything the backend already records via the audit log, read
 * straight through (no client-side event synthesis). */
export function ActivityTimeline({ tournamentId }: { tournamentId: string }) {
  const activity = useTournamentActivity(tournamentId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activity.isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9 rounded-xl" />
            <Skeleton className="h-9 rounded-xl" />
            <Skeleton className="h-9 rounded-xl" />
          </div>
        ) : activity.isError ? (
          <ErrorState
            error={activity.error}
            onRetry={() => activity.refetch()}
            title="Couldn't load activity"
            className="py-6"
          />
        ) : activity.data && activity.data.length > 0 ? (
          <ol className="flex max-h-[420px] flex-col gap-2.5 overflow-y-auto pr-1">
            {activity.data.map((event) => (
              <li
                key={event.id}
                className="border-border flex items-start justify-between gap-3 border-t pt-2.5 text-sm first:border-t-0 first:pt-0"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{activityActionLabel(event.action)}</span>
                  <span className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.14em]">
                    {event.entity}
                  </span>
                </div>
                <span className="text-muted-foreground text-2xs shrink-0 font-mono tabular-nums">
                  {new Date(event.createdAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState
            icon={Activity}
            title="No activity yet"
            description="Score submissions, corrections, and draw events will show up here."
            className="py-8"
          />
        )}
      </CardContent>
    </Card>
  );
}
