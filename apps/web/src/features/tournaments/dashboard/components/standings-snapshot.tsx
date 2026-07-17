"use client";

import type { ParticipantResponse, StageResponse, StandingsView } from "@tournament/api-client";
import Link from "next/link";
import { Download, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TeamBadge } from "@/components/ui/team-badge";
import { toast } from "@/components/ui/sonner";
import { getFormat } from "@/features/tournaments/config";
import { topStandingsRows } from "@/features/tournaments/dashboard/config";
import { env } from "@/lib/env";

async function downloadCsv(url: string, filename: string) {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`${res.status}`);
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(href);
  } catch {
    toast.error("Export failed — try again");
  }
}

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
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5" strokeWidth={2.25} />
          Standings snapshot
        </CardTitle>
        <Button
          tone="ghost"
          size="sm"
          className="shrink-0"
          onClick={() =>
            void downloadCsv(
              `${env.apiUrl}/api/v1/tournaments/${tournamentId}/export/standings.csv`,
              "standings.csv",
            )
          }
        >
          <Download className="h-4 w-4" strokeWidth={2.25} />
          CSV
        </Button>
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
                  href={`/console/tournaments/${tournamentId}/draws`}
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
                        className="flex justify-between gap-2 text-sm tabular-nums"
                      >
                        <span className="flex flex-col gap-0.5">
                          <TeamBadge teamName={participantsById.get(row.participantId)?.teamName} />
                          <span>
                            #{row.rank}{" "}
                            {participantsById.get(row.participantId)?.displayName ??
                              row.participantId.slice(0, 8)}
                          </span>
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
