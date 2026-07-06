"use client";

import type { MatchView, ParticipantResponse } from "@tournament/api-client";
import { Crown, Swords } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TERMINAL = new Set(["completed", "walkover", "no_show"]);
const MAX_SHOWN = 8;

function parseGames(payload: Record<string, unknown>): string | null {
  const games = payload.games;
  if (!Array.isArray(games) || games.length === 0) return null;
  return (games as number[][])
    .filter((g) => Array.isArray(g) && g.length === 2)
    .map(([a, b]) => `${a}–${b}`)
    .join(", ");
}

function ResultRow({
  match,
  participantsById,
}: {
  match: MatchView;
  participantsById: Map<string, ParticipantResponse>;
}) {
  const winnerSide = match.sides.find((s) => s.outcome === "win");
  const loserSide = match.sides.find((s) => s.outcome === "loss");
  const winnerName =
    participantsById.get(winnerSide?.participantId ?? "")?.displayName ?? "Unknown";
  const loserName = participantsById.get(loserSide?.participantId ?? "")?.displayName ?? "Unknown";

  const isWalkover = match.status === "walkover" || match.status === "no_show";
  const scoreStr = isWalkover
    ? "Walkover"
    : (parseGames(match.resultPayload as Record<string, unknown>) ?? null);

  return (
    <div className="flex items-start gap-3 py-2.5">
      <div
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          "bg-candy-tint text-candy-dark",
        )}
      >
        <Crown className="h-3.5 w-3.5" strokeWidth={2.5} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-snug">{winnerName}</p>
        <p className="text-muted-foreground truncate text-xs">def. {loserName}</p>
        {scoreStr ? (
          <p className="text-foreground/70 mt-0.5 font-mono text-xs">{scoreStr}</p>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-muted-foreground text-xs">{match.roundLabel ?? ""}</p>
      </div>
    </div>
  );
}

/** Shows last 8 completed/walkover matches with winner, score, and round — dashboard panel. */
export function RecentResultsPanel({
  tournamentId,
  matches,
  participantsById,
}: {
  tournamentId: string;
  matches: MatchView[];
  participantsById: Map<string, ParticipantResponse>;
}) {
  const recent = matches
    .filter((m) => TERMINAL.has(m.status))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, MAX_SHOWN);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Swords className="h-5 w-5" strokeWidth={2.25} />
          Recent results
        </CardTitle>
        <Link
          href={`/console/tournaments/${tournamentId}/matches`}
          className="text-candy-dark text-sm font-semibold"
        >
          All matches
        </Link>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            No results yet — completed matches appear here.
          </p>
        ) : (
          <div className="divide-border divide-y">
            {recent.map((m) => (
              <ResultRow key={m.id} match={m} participantsById={participantsById} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
