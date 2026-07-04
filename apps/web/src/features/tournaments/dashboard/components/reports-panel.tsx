"use client";

import type { DivisionResponse, TournamentResponse } from "@tournament/api-client";
import Link from "next/link";
import { ExternalLink, FileSpreadsheet, Monitor, Upload } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PUBLISH_ARTIFACTS } from "@/features/tournaments/config";

export function ReportsPanel({
  tournament,
  divisions,
  canManage,
}: {
  tournament: TournamentResponse;
  divisions: DivisionResponse[];
  canManage: boolean;
}) {
  const publicUrl = `/t/${tournament.slug}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Reports & exports</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button asChild tone="paper" className="justify-start">
          <Link href={publicUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" strokeWidth={2.25} />
            Public tournament page
          </Link>
        </Button>
        <Button asChild tone="paper" className="justify-start">
          <Link
            href={`/console/tournaments/${tournament.id}/schedule/dashboard`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Monitor className="h-4 w-4" strokeWidth={2.25} />
            TV court dashboard
          </Link>
        </Button>
        {canManage
          ? divisions.map((d) => (
              <Button key={d.id} asChild tone="paper" className="justify-start">
                <Link href={`/console/tournaments/${tournament.id}/divisions/${d.id}/registrations`}>
                  <FileSpreadsheet className="h-4 w-4" strokeWidth={2.25} />
                  {d.name} — export registrations
                </Link>
              </Button>
            ))
          : null}
        <div className="border-border mt-2 border-t pt-3">
          <p className="text-muted-foreground mb-2 text-2xs font-mono uppercase tracking-[0.18em]">
            Publication status
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {PUBLISH_ARTIFACTS.map((artifact) => {
              const published = tournament[artifact.field];
              return (
                <li key={artifact.key} className="flex items-center gap-2">
                  <Upload className="text-muted-foreground h-3.5 w-3.5" />
                  {artifact.label}: {published ? "Published" : "Not published"}
                </li>
              );
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
