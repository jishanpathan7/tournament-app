"use client";

import type { CourtQueueView, ParticipantResponse } from "@tournament/api-client";
import { ChevronRight, Radio, RefreshCw, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { DEFAULT_DURATION_MINUTES, matchParticipantLabel } from "@/features/scheduling/config";
import {
  countLiveCourts,
  courtUtilization,
  deriveCourtOpsState,
  elapsedMinutes,
  estimatedWaitMinutes,
  formatMatchSides,
  liveScoreDisplay,
  pickCallTarget,
  setLabel,
  type CourtOpsState,
} from "@/features/scheduling/live-dashboard-config";
import { useAssignSchedule, useScheduleQueue } from "@/features/scheduling/use-schedule";
import { useTournamentParticipants } from "@/features/matches/use-tournament-matches";
import { useTournament } from "@/features/tournaments/use-tournaments";
import { getSport } from "@/features/tournaments/config";
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";
import { errorMessage } from "@/lib/problem";
import { cn } from "@/lib/utils";

const LIVE_REFRESH_MS = 300_000;

const STATE_STYLES: Record<CourtOpsState, { card: string; badge: string; badgeLabel: string }> = {
  active: {
    card: "border-mint bg-mint-tint/40",
    badge: "bg-mint text-ink",
    badgeLabel: "ACTIVE",
  },
  turnover: {
    card: "border-yellow bg-yellow-tint/50",
    badge: "bg-yellow text-ink",
    badgeLabel: "TURNOVER",
  },
  open: {
    card: "border-ink bg-card",
    badge: "border-ink bg-card text-muted-foreground border",
    badgeLabel: "OPEN",
  },
  disabled: {
    card: "border-border bg-muted/30 opacity-60",
    badge: "bg-muted text-muted-foreground",
    badgeLabel: "OFFLINE",
  },
};

function CourtCard({
  entry,
  participantsById,
  now,
}: {
  entry: CourtQueueView;
  participantsById: Map<string, ParticipantResponse>;
  now: number;
}) {
  const state = deriveCourtOpsState(entry);
  const styles = STATE_STYLES[state];
  const match = entry.currentMatch;

  return (
    <div
      className={cn(
        "shadow-sticker-xs flex min-h-[168px] flex-col gap-3 rounded-2xl border-2 p-4 transition-colors",
        styles.card,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-serif text-xl font-semibold tracking-tight">{entry.court.name}</span>
        <span
          className={cn(
            "text-2xs rounded-full px-2 py-0.5 font-mono font-semibold uppercase tracking-wider",
            styles.badge,
          )}
        >
          {styles.badgeLabel}
        </span>
      </div>

      {state === "active" && match ? (
        <>
          <p className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.2em]">
            {setLabel(match)}
            {elapsedMinutes(match.scheduledAt, now) != null
              ? ` • ${elapsedMinutes(match.scheduledAt, now)} MIN`
              : ""}
          </p>
          <div className="flex flex-col gap-1 text-sm font-medium leading-snug">
            <span>{formatMatchSides(match, participantsById).home}</span>
            <span className="text-muted-foreground text-xs font-normal">vs</span>
            <span>{formatMatchSides(match, participantsById).away}</span>
          </div>
          {liveScoreDisplay(match) ? (
            <p className="font-serif text-3xl font-semibold tabular-nums tracking-tight">
              {liveScoreDisplay(match)}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">Score not entered yet</p>
          )}
        </>
      ) : null}

      {state === "turnover" ? (
        <div className="flex flex-1 flex-col justify-center gap-1">
          <p className="font-medium">Cleaning — next in ~2 min</p>
          {entry.nextMatch ? (
            <p className="text-muted-foreground text-sm">
              Up next: {matchParticipantLabel(entry.nextMatch, participantsById)}
            </p>
          ) : null}
        </div>
      ) : null}

      {state === "open" ? (
        <div className="flex flex-1 flex-col justify-center">
          <p className="text-muted-foreground font-medium">Available</p>
        </div>
      ) : null}

      {state === "disabled" ? (
        <p className="text-muted-foreground text-sm">Court unavailable</p>
      ) : null}
    </div>
  );
}

function UtilizationBars({ pct }: { pct: number }) {
  const bars = [40, 55, 70, 85, 60, 45, pct];
  return (
    <div className="flex h-16 items-end gap-1.5">
      {bars.map((h, i) => (
        <div
          key={i}
          className={cn("flex-1 rounded-t-md", i === bars.length - 1 ? "bg-candy" : "bg-candy/30")}
          style={{ height: `${Math.min(100, h)}%` }}
        />
      ))}
    </div>
  );
}

/** Venue ops board — live court states, waiting queue, call-next action. */
export function LiveDashboard({ tournamentId }: { tournamentId: string }) {
  const can = useCan();
  const canManage = can(ACTIONS.SCHEDULE_MANAGE);
  const tournament = useTournament(tournamentId);
  const queue = useScheduleQueue(tournamentId, { refetchInterval: LIVE_REFRESH_MS });
  const participants = useTournamentParticipants(tournamentId);
  const assign = useAssignSchedule(tournamentId);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const participantsById = useMemo(
    () => new Map((participants.data ?? []).map((p) => [p.id, p])),
    [participants.data],
  );

  const data = queue.data;
  const utilization = data ? courtUtilization(data.courts) : { pct: 0, active: 0, total: 0 };
  const liveCount = data ? countLiveCourts(data.courts) : 0;
  const callTarget = data ? pickCallTarget(data.courts) : null;
  const nextWaiting = data?.unscheduled[0] ?? null;
  const activeCourts = data?.courts.filter((c) => c.court.status === "active").length ?? 0;

  const updatedAgo =
    queue.dataUpdatedAt > 0 ? Math.max(0, Math.floor((now - queue.dataUpdatedAt) / 1000)) : null;

  const sport = tournament.data ? getSport(tournament.data.sportKey) : null;

  const onCallNext = () => {
    if (!callTarget || !nextWaiting) return;
    assign.mutate(
      {
        matchId: nextWaiting.id,
        body: {
          courtId: callTarget.court.id,
          scheduledAt: new Date().toISOString(),
          durationMinutes: DEFAULT_DURATION_MINUTES,
        },
      },
      {
        onSuccess: () =>
          toast.success(
            `Called ${matchParticipantLabel(nextWaiting, participantsById)} to ${callTarget.court.name}`,
          ),
        onError: (e) => toast.error(errorMessage(e, "Couldn't assign match to court")),
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Run"
          title="Live Dashboard"
          description={
            tournament.data
              ? `${tournament.data.name}${sport ? ` · ${sport.label}` : ""}`
              : "Real-time court operations"
          }
        />
        <div className="flex flex-col items-end gap-2">
          <Badge tone="pink" className="gap-1.5 px-3 py-1 text-sm">
            <Radio className="h-3.5 w-3.5" strokeWidth={2.5} />
            {liveCount} LIVE
          </Badge>
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.18em]">
              Auto-refresh 5m
              {updatedAgo != null ? ` · updated ${updatedAgo}s ago` : ""}
            </p>
            <Button
              tone="ghost"
              size="sm"
              className="text-2xs h-7 gap-1.5 px-2 font-mono uppercase tracking-[0.12em]"
              disabled={queue.isFetching}
              aria-label="Refresh live dashboard"
              onClick={() => void queue.refetch()}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", queue.isFetching && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {queue.isLoading || tournament.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      ) : queue.isError ? (
        <ErrorState error={queue.error} onRetry={() => queue.refetch()} />
      ) : !data?.courts.length ? (
        <EmptyState
          icon={Radio}
          title="No courts assigned"
          description="Assign courts to this tournament, then schedule matches to see live ops."
          action={
            canManage ? (
              <Button asChild tone="candy">
                <Link href={`/console/tournaments/${tournamentId}/courts`}>Set up courts</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.courts.map((entry) => (
              <CourtCard
                key={entry.court.id}
                entry={entry}
                participantsById={participantsById}
                now={now}
              />
            ))}
          </div>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" strokeWidth={2.25} />
                  Waiting players
                </CardTitle>
                <Badge tone="yellow">{data.unscheduled.length} in queue</Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {data.unscheduled.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No one waiting — all ready matches have courts.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {data.unscheduled.slice(0, 8).map((m, i) => (
                      <li
                        key={m.id}
                        className="border-ink/10 flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate font-medium">
                          {matchParticipantLabel(m, participantsById)}
                        </span>
                        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                          {estimatedWaitMinutes(i, activeCourts)} min
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {canManage && callTarget && nextWaiting ? (
                  <Button
                    tone="candy"
                    className="w-full justify-between"
                    disabled={assign.isPending}
                    onClick={onCallNext}
                  >
                    Call next pair
                    <span className="flex items-center gap-1 text-sm font-normal opacity-90">
                      {callTarget.court.name}
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </Button>
                ) : null}

                {canManage && !callTarget && data.unscheduled.length > 0 ? (
                  <p className="text-muted-foreground text-xs">
                    All courts busy — clear a court to call the next pair.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Court utilization</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <UtilizationBars pct={utilization.pct} />
                <p className="text-muted-foreground text-sm">
                  <span className="text-foreground font-semibold tabular-nums">
                    {utilization.pct}%
                  </span>{" "}
                  avg
                  {utilization.total > 0 ? (
                    <>
                      {" "}
                      · {utilization.active}/{utilization.total} courts active now
                    </>
                  ) : null}
                </p>
              </CardContent>
            </Card>

            <Button asChild tone="paper" size="sm" className="self-start">
              <Link
                href={`/console/tournaments/${tournamentId}/schedule/dashboard`}
                target="_blank"
              >
                Open TV display
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
