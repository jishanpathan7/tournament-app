"use client";

import type { ParticipantResponse, StageResponse, StandingsView } from "@tournament/api-client";
import Link from "next/link";
import { Trophy } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFormat } from "@/features/tournaments/config";
import { topStandingsRows } from "@/features/tournaments/dashboard/config";

export function StandingsSnapshot({
  tournamentId,
  stages,
  standingsByStage,
  participantsById,
}: {
  tournamentId: string;
  stages: StageResponse[];
  standingsByStage: Map<string, StandingsView>;
  participantsById: Map<string, ParticipantResponse>;
}) {
  const drawnStages = stages.filter((s) => s.drawn).slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5" strokeWidth={2.25} />
          Standings snapshot
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {drawnStages.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Standings appear once draws are generated.
          </p>
        ) : (
          drawnStages.map((stage) => {
            const rows = topStandingsRows(standingsByStage.get(stage.id));
            return (
              <div key={stage.id}>
                <Link
                  href={`/console/tournaments/${tournamentId}/divisions/${stage.divisionId}/stages/${stage.id}/draw`}
                  className="text-sm font-semibold hover:underline"
                >
                  {getFormat(stage.type)?.label ?? stage.type} · Stage {stage.seq + 1}
                </Link>
                {rows.length === 0 ? (
                  <p className="text-muted-foreground mt-1 text-xs">No results yet</p>
                ) : (
                  <ol className="mt-2 flex flex-col gap-1">
                    {rows.map((row) => (
                      <li
                        key={row.participantId}
                        className="flex justify-between text-sm tabular-nums"
                      >
                        <span>
                          #{row.rank}{" "}
                          {participantsById.get(row.participantId)?.displayName ??
                            row.participantId.slice(0, 8)}
                        </span>
                        <span className="text-muted-foreground">{row.points} pts</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
