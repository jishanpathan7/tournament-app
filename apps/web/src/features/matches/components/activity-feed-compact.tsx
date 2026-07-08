"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  activityActionLabel,
  filterMeaningfulActivity,
  matchIdFromActivity,
} from "@/features/matches/config";
import { useTournamentActivity } from "@/features/matches/use-tournament-matches";

export function ActivityFeedCompact({
  tournamentId,
  onOpenMatch,
}: {
  tournamentId: string;
  onOpenMatch?: (matchId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const activity = useTournamentActivity(tournamentId);

  const meaningful = useMemo(
    () => filterMeaningfulActivity(activity.data ?? []).slice(0, expanded ? undefined : 5),
    [activity.data, expanded],
  );

  if (activity.isLoading) {
    return <Skeleton className="h-24 rounded-2xl" />;
  }

  if (activity.isError) {
    return null;
  }

  if (meaningful.length === 0 && !expanded) {
    return null;
  }

  return (
    <Card className="border-ink shadow-sticker-xs border-2">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">Recent activity</CardTitle>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs font-semibold"
        >
          {expanded ? (
            <>
              Collapse <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Full timeline <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </CardHeader>
      <CardContent>
        {expanded ? (
          <ol className="flex max-h-[420px] flex-col gap-2.5 overflow-y-auto pr-1">
            {filterMeaningfulActivity(activity.data ?? []).map((event) => {
              const matchId = matchIdFromActivity(event);
              return (
                <li
                  key={event.id}
                  className="border-border flex items-start justify-between gap-3 border-t pt-2.5 text-sm first:border-t-0 first:pt-0"
                >
                  <button
                    type="button"
                    disabled={!matchId || !onOpenMatch}
                    onClick={() => matchId && onOpenMatch?.(matchId)}
                    className="flex flex-1 flex-col gap-0.5 text-left disabled:cursor-default"
                  >
                    <span className="font-medium">{activityActionLabel(event.action)}</span>
                    <span className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.14em]">
                      {event.entity}
                    </span>
                  </button>
                  <span className="text-muted-foreground text-2xs shrink-0 font-mono tabular-nums">
                    {new Date(event.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <ol className="flex flex-col gap-2">
            {meaningful.map((event) => {
              const matchId = matchIdFromActivity(event);
              return (
                <li key={event.id}>
                  <button
                    type="button"
                    disabled={!matchId || !onOpenMatch}
                    onClick={() => matchId && onOpenMatch?.(matchId)}
                    className="hover:bg-muted/50 flex w-full items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-left text-sm disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <span className="font-medium">{activityActionLabel(event.action)}</span>
                    <span className="text-muted-foreground text-2xs font-mono tabular-nums">
                      {new Date(event.createdAt).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
