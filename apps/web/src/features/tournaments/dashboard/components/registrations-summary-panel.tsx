"use client";

import type { DivisionResponse } from "@tournament/api-client";
import Link from "next/link";
import { Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RegistrationTotals } from "@/features/tournaments/dashboard/config";

export function RegistrationsSummaryPanel({
  tournamentId,
  divisions,
  totals,
  canManage,
}: {
  tournamentId: string;
  divisions: DivisionResponse[];
  totals: RegistrationTotals;
  canManage: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" strokeWidth={2.25} />
          Registrations
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-3 text-sm">
          <span>
            <span className="font-semibold">{totals.approved}</span> approved
          </span>
          {totals.pending > 0 ? <Badge tone="candy">{totals.pending} pending</Badge> : null}
          {totals.waitlisted > 0 ? (
            <Badge tone="yellow">{totals.waitlisted} waitlisted</Badge>
          ) : null}
        </div>
        <ul className="divide-border divide-y">
          {divisions.map((d) => (
            <li key={d.id} className="text-muted-foreground py-2 text-sm">
              {d.name}
            </li>
          ))}
        </ul>
        {canManage && (
          <Link
            href={`/console/tournaments/${tournamentId}/players`}
            className="text-candy-dark text-sm font-semibold underline-offset-2 hover:underline"
          >
            Open all players
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
