"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useMatchEvents } from "@/features/scoring/use-matches";

const EVENT_TYPE_LABELS: Record<string, string> = {
  normal: "Score submitted",
  walkover: "Walkover recorded",
  retirement: "Retirement recorded",
  no_show: "No-show recorded",
  correction: "Score corrected",
};

/** A match's append-only scoring log (`MatchResultEvent`) — every submission and
 * correction, oldest first, with whoever recorded it. */
export function MatchHistoryList({ matchId }: { matchId: string }) {
  const events = useMatchEvents(matchId);

  if (events.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-10 rounded-xl" />
      </div>
    );
  }
  if (events.isError) {
    return <p className="text-muted-foreground text-sm">Couldn&apos;t load history.</p>;
  }
  if (!events.data || events.data.length === 0) {
    return <p className="text-muted-foreground text-sm">No results recorded yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-2">
      {events.data.map((event) => (
        <li
          key={event.id}
          className="border-border flex items-center justify-between gap-3 border-t pt-2 text-sm first:border-t-0 first:pt-0"
        >
          <span className="font-medium">{EVENT_TYPE_LABELS[event.type] ?? event.type}</span>
          <span className="text-muted-foreground font-mono text-2xs tabular-nums">
            {new Date(event.createdAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        </li>
      ))}
    </ol>
  );
}
