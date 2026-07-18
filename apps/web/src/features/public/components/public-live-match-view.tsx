"use client";

import { ArrowLeft, Network } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { ErrorState } from "@/components/common/error-state";
import { Badge } from "@/components/ui/badge";
import { TeamBadge } from "@/components/ui/team-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { matchStatusMeta } from "@/features/draws/config";
import { participantName } from "@/features/public/config";
import {
  usePublicMatch,
  usePublicMatchEvents,
  usePublicParticipants,
} from "@/features/public/use-public-tournament";

const EVENT_TYPE_LABELS: Record<string, string> = {
  normal: "Score submitted",
  walkover: "Walkover recorded",
  retirement: "Retirement recorded",
  no_show: "No-show recorded",
  correction: "Score corrected",
};

const TERMINAL_STATUSES = new Set(["completed", "walkover", "no_show", "cancelled"]);

/** Current score, status, history, and — once decided — a pointer to the bracket for
 * advancement (the bracket's own winner-advances wiring is internal-only, even to the
 * organizer console, so this links out rather than naming the next match directly).
 * Live updates arrive via the tournament-wide realtime subscription the layout already
 * holds open — this page doesn't open its own connection, it just reads query state
 * that subscription invalidates. */
export function PublicLiveMatchView({ slug, matchId }: { slug: string; matchId: string }) {
  const match = usePublicMatch(slug, matchId);
  const events = usePublicMatchEvents(slug, matchId);
  const participants = usePublicParticipants(slug);

  const participantsById = useMemo(
    () => new Map((participants.data ?? []).map((p) => [p.id, p])),
    [participants.data],
  );

  if (match.isLoading) {
    return <Skeleton className="h-64 rounded-2xl" />;
  }
  if (match.isError || !match.data) {
    return <ErrorState error={match.error} title="Match not found" />;
  }

  const status = matchStatusMeta(match.data.status);
  const games = Array.isArray(match.data.resultPayload?.games)
    ? (match.data.resultPayload.games as [number, number][])
    : [];
  const isDone = TERMINAL_STATUSES.has(match.data.status);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/t/${slug}/fixtures`}
        className="text-muted-foreground -ml-1 flex items-center gap-1 self-start text-sm font-semibold hover:underline"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
        Fixtures
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {match.data.sides
            .map((s) => participantName(s.participantId, participantsById))
            .join(" vs ")}
        </h1>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <p className="text-muted-foreground text-sm">{match.data.roundLabel ?? "Round"}</p>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Score</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {match.data.sides.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Waiting on an earlier match to be decided.
            </p>
          ) : (
            match.data.sides.map((side) => (
              <div key={side.participantId} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <TeamBadge teamName={participantsById.get(side.participantId)?.teamName} />
                  <Link
                    href={`/t/${slug}/participants/${side.participantId}`}
                    className={`hover:underline ${side.outcome === "win" ? "font-bold" : ""}`}
                  >
                    {participantName(side.participantId, participantsById)}
                  </Link>
                </div>
                <span
                  className={`font-mono text-lg font-bold tabular-nums ${
                    side.outcome === "win" ? "text-mint-dark" : "text-muted-foreground"
                  }`}
                >
                  {side.scoreFor ?? "—"}
                </span>
              </div>
            ))
          )}
          {games.length > 0 ? (
            <div className="border-border mt-2 flex flex-wrap gap-2 border-t pt-3">
              {games.map((game, i) => (
                <span
                  key={i}
                  className="border-ink bg-muted rounded-lg border-2 px-2 py-1 font-mono text-xs tabular-nums"
                >
                  {game[0]}–{game[1]}
                </span>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {isDone ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Network className="text-candy-dark h-5 w-5 shrink-0" strokeWidth={2.25} />
            <p className="text-sm">
              This match is complete — see the{" "}
              <Link href={`/t/${slug}/bracket`} className="text-candy-dark font-semibold underline">
                bracket
              </Link>{" "}
              for who plays next.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-xl font-semibold tracking-tight">History</h2>
        {events.isLoading ? (
          <Skeleton className="h-16 rounded-xl" />
        ) : (events.data?.length ?? 0) === 0 ? (
          <p className="text-muted-foreground text-sm">No results recorded yet.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {events.data!.map((event) => (
              <li
                key={event.id}
                className="border-border flex items-center justify-between gap-3 border-t pt-2 text-sm first:border-t-0 first:pt-0"
              >
                <span className="font-medium">{EVENT_TYPE_LABELS[event.type] ?? event.type}</span>
                <span className="text-muted-foreground text-2xs font-mono tabular-nums">
                  {new Date(event.createdAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
