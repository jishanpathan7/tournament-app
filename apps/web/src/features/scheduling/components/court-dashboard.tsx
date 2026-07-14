"use client";

import { useMemo } from "react";

import { ErrorState } from "@/components/common/error-state";
import { LoadingPanel } from "@/components/common/loading";
import { Badge } from "@/components/ui/badge";
import { matchStatusMeta } from "@/features/draws/config";
import { matchParticipantLabel } from "@/features/scheduling/config";
import { useScheduleQueue } from "@/features/scheduling/use-schedule";
import { useTournamentParticipants } from "@/features/matches/use-tournament-matches";
import { useSession } from "@/features/auth/use-session";
import { useRealtime } from "@/hooks/use-realtime";
import { orgChannel } from "@/lib/realtime";
import { cn } from "@/lib/utils";

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Fullscreen, chrome-free, high-contrast board meant for a wall-mounted TV or venue
 * display — every court's current + next match, refreshed by realtime events (via the
 * org channel, subscribed directly here since this page renders outside the console
 * AppShell) with a polling fallback for displays that never get a live event. */
export function CourtDashboard({ tournamentId }: { tournamentId: string }) {
  const { session } = useSession();
  const channel = session?.activeOrganizationId ? orgChannel(session.activeOrganizationId) : null;
  useRealtime(channel);

  const queue = useScheduleQueue(tournamentId, { enabled: true });
  const participants = useTournamentParticipants(tournamentId);
  const participantsById = useMemo(
    () => new Map((participants.data ?? []).map((p) => [p.id, p])),
    [participants.data],
  );

  if (queue.isLoading) {
    return (
      <div className="bg-ink flex h-screen items-center justify-center">
        <LoadingPanel label="Loading court dashboard" />
      </div>
    );
  }
  if (queue.isError) {
    return (
      <div className="bg-ink flex h-screen items-center justify-center p-8">
        <ErrorState error={queue.error} onRetry={() => queue.refetch()} />
      </div>
    );
  }

  const data = queue.data!;

  return (
    <div className="bg-ink min-h-screen p-8 text-white">
      <h1 className="mb-6 font-serif text-4xl font-semibold text-white">Court Status</h1>
      {data.courts.length === 0 ? (
        <p className="text-lg text-white/70">No courts assigned to this tournament.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.courts.map((c) => (
            <div
              key={c.court.id}
              className={cn(
                "text-ink flex flex-col gap-3 rounded-3xl border-2 bg-white p-6",
                c.isDelayed ? "border-pink" : "border-white/20",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-serif text-2xl font-semibold">{c.court.name}</span>
                {c.isDelayed ? (
                  <Badge tone="pink">Delayed</Badge>
                ) : !c.currentMatch ? (
                  <Badge tone="mint">Free</Badge>
                ) : c.currentMatch.status === "live" ? (
                  <Badge tone="candy">Live</Badge>
                ) : (
                  <Badge tone={matchStatusMeta(c.currentMatch.status).tone}>
                    {matchStatusMeta(c.currentMatch.status).label}
                  </Badge>
                )}
              </div>
              {c.currentMatch ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xl font-medium">
                    {matchParticipantLabel(c.currentMatch, participantsById)}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge tone={matchStatusMeta(c.currentMatch.status).tone}>
                      {matchStatusMeta(c.currentMatch.status).label}
                    </Badge>
                    <span className="text-muted-foreground text-sm tabular-nums">
                      {formatTime(c.currentMatch.scheduledAt)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-lg">Court is free</p>
              )}
              <div className="border-border mt-2 border-t pt-2">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">Up next</p>
                {c.nextMatch ? (
                  <p className="text-base">
                    {matchParticipantLabel(c.nextMatch, participantsById)} ·{" "}
                    {formatTime(c.nextMatch.scheduledAt)}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-base">Nothing queued</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
