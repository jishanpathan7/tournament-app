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

function formatEventPayload(payload: Record<string, unknown>): string | null {
  const games = payload.games;
  if (Array.isArray(games) && games.length > 0) {
    return (games as number[][])
      .filter((g) => Array.isArray(g) && g.length === 2)
      .map(([a, b]) => `${a}–${b}`)
      .join(", ");
  }
  if (payload.endedBy === "walkover" || payload.endedBy === "no_show") {
    return "Walkover";
  }
  return null;
}

/** A match's append-only scoring log — every submission and correction, oldest first. */
export function MatchHistoryList({
  matchId,
  enriched = false,
}: {
  matchId: string;
  enriched?: boolean;
}) {
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
      {events.data.map((event) => {
        const detail = enriched
          ? formatEventPayload(event.payload as Record<string, unknown>)
          : null;
        return (
          <li
            key={event.id}
            className="border-border flex flex-col gap-1 border-t pt-2 text-sm first:border-t-0 first:pt-0"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{EVENT_TYPE_LABELS[event.type] ?? event.type}</span>
              <span className="text-muted-foreground text-2xs font-mono tabular-nums">
                {new Date(event.createdAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            </div>
            {detail ? (
              <span className="text-muted-foreground font-mono text-xs tabular-nums">{detail}</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
