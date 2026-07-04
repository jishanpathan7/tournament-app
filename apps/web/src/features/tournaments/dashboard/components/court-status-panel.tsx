"use client";

import Link from "next/link";
import { LayoutGrid } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueuePanel } from "@/features/scheduling/components/queue-panel";

export function CourtStatusPanel({ tournamentId }: { tournamentId: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <LayoutGrid className="h-5 w-5" strokeWidth={2.25} />
          Court status
        </CardTitle>
        <Button asChild tone="ghost" size="sm">
          <Link href={`/console/tournaments/${tournamentId}/live`}>Live dashboard</Link>
        </Button>
        <Button asChild tone="ghost" size="sm">
          <Link href={`/console/tournaments/${tournamentId}/schedule`}>Schedule</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <QueuePanel tournamentId={tournamentId} compact />
      </CardContent>
    </Card>
  );
}
