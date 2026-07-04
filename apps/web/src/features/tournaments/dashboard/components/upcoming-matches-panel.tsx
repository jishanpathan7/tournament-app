"use client";

import type { ScheduleQueueView } from "@tournament/api-client";
import type { ParticipantResponse } from "@tournament/api-client";
import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { matchParticipantLabel } from "@/features/scheduling/config";

export function UpcomingMatchesPanel({
  tournamentId,
  queue,
  participantsById,
}: {
  tournamentId: string;
  queue: ScheduleQueueView | undefined;
  participantsById: Map<string, ParticipantResponse>;
}) {
  const upcoming = [
    ...(queue?.courts.flatMap((c) => (c.nextMatch ? [c.nextMatch] : [])) ?? []),
    ...(queue?.unscheduled ?? []),
  ].slice(0, 8);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarClock className="h-5 w-5" strokeWidth={2.25} />
          Upcoming matches
        </CardTitle>
        <Link
          href={`/console/tournaments/${tournamentId}/schedule`}
          className="text-candy-dark text-sm font-semibold"
        >
          View schedule
        </Link>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <p className="text-muted-foreground text-sm">No upcoming matches in the queue.</p>
        ) : (
          <ul className="divide-border divide-y">
            {upcoming.map((m) => (
              <li key={m.id} className="flex flex-col gap-0.5 py-2 text-sm">
                <span className="font-medium">{matchParticipantLabel(m, participantsById)}</span>
                {m.roundLabel ? (
                  <span className="text-muted-foreground text-xs">{m.roundLabel}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
