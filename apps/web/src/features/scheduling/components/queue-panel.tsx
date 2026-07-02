"use client";

import { Clock, Users } from "lucide-react";
import { useMemo } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingPanel } from "@/components/common/loading";
import { Badge } from "@/components/ui/badge";
import { matchStatusMeta } from "@/features/draws/config";
import { matchParticipantLabel } from "@/features/scheduling/config";
import { useScheduleQueue } from "@/features/scheduling/use-schedule";
import { useTournamentParticipants } from "@/features/matches/use-tournament-matches";

function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Compact organizer-facing view of "what's happening right now": each court's
 * current/next match and whether it's running late, plus who's waiting for a court. */
export function QueuePanel({ tournamentId }: { tournamentId: string }) {
  const queue = useScheduleQueue(tournamentId);
  const participants = useTournamentParticipants(tournamentId);
  const participantsById = useMemo(
    () => new Map((participants.data ?? []).map((p) => [p.id, p])),
    [participants.data],
  );

  if (queue.isLoading) return <LoadingPanel label="Loading queue" />;
  if (queue.isError) return <ErrorState error={queue.error} onRetry={() => queue.refetch()} />;

  const data = queue.data!;
  const freeCourts = data.courts.filter((c) => !c.currentMatch);
  const delayedCourts = data.courts.filter((c) => c.isDelayed);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        <Badge tone="mint">{freeCourts.length} free court{freeCourts.length === 1 ? "" : "s"}</Badge>
        {delayedCourts.length > 0 ? (
          <Badge tone="pink">
            {delayedCourts.length} delayed court{delayedCourts.length === 1 ? "" : "s"}
          </Badge>
        ) : null}
        <Badge tone="candy">{data.unscheduled.length} waiting to be scheduled</Badge>
      </div>

      {data.courts.length === 0 ? (
        <EmptyState icon={Clock} title="No courts assigned" description="Assign a court to see the live queue." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.courts.map((c) => (
            <div
              key={c.court.id}
              className="border-ink bg-card shadow-sticker-xs flex flex-col gap-2 rounded-2xl border-2 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{c.court.name}</span>
                {c.isDelayed ? <Badge tone="pink">Delayed</Badge> : !c.currentMatch ? (
                  <Badge tone="mint">Free</Badge>
                ) : null}
              </div>
              {c.currentMatch ? (
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">
                    {matchParticipantLabel(c.currentMatch, participantsById)}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge tone={matchStatusMeta(c.currentMatch.status).tone}>
                      {matchStatusMeta(c.currentMatch.status).label}
                    </Badge>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {formatTime(c.currentMatch.scheduledAt)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No match in progress.</p>
              )}
              {c.nextMatch ? (
                <p className="text-muted-foreground text-xs">
                  Next: {matchParticipantLabel(c.nextMatch, participantsById)} ·{" "}
                  {formatTime(c.nextMatch.scheduledAt)}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-serif text-lg font-semibold">
          <Users className="h-4 w-4" strokeWidth={2.25} />
          Waiting for a court
        </h2>
        {data.unscheduled.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nobody waiting — every ready match has a court.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.unscheduled.map((m) => (
              <li
                key={m.id}
                className="border-border bg-card flex items-center justify-between rounded-xl border px-3 py-2 text-sm"
              >
                <span>{matchParticipantLabel(m, participantsById)}</span>
                {m.roundLabel ? (
                  <span className="text-muted-foreground text-xs">{m.roundLabel}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
