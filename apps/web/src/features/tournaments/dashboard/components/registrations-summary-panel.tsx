"use client";

import type {
  DivisionResponse,
  ParticipantResponse,
  RegistrationResponse,
} from "@tournament/api-client";
import Link from "next/link";
import { Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { deriveCapacity } from "@/features/registrations/capacity";
import type { RegistrationTotals } from "@/features/tournaments/dashboard/config";

export function RegistrationsSummaryPanel({
  tournamentId,
  divisions,
  totals,
  registrationsByDivision,
  participantsByDivision,
  canManage,
}: {
  tournamentId: string;
  divisions: DivisionResponse[];
  totals: RegistrationTotals;
  registrationsByDivision?: Map<string, RegistrationResponse[]>;
  participantsByDivision?: Map<string, ParticipantResponse[]>;
  canManage: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" strokeWidth={2.25} />
          Participants
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
          {divisions.map((d) => {
            const regs = registrationsByDivision?.get(d.id) ?? [];
            const parts = participantsByDivision?.get(d.id) ?? [];
            const hasData = registrationsByDivision?.has(d.id);
            const summary = hasData ? deriveCapacity(null, regs, parts) : null;

            return (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  {canManage ? (
                    <Link
                      href={`/console/tournaments/${tournamentId}/registrations?division=${d.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {d.name}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium">{d.name}</span>
                  )}
                </div>

                {summary ? (
                  <div className="flex shrink-0 items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">{summary.approved} approved</span>
                    {summary.pending > 0 && (
                      <Badge tone="candy" className="text-2xs">
                        {summary.pending} pending
                      </Badge>
                    )}
                    {summary.waitlisted > 0 && (
                      <Badge tone="yellow" className="text-2xs">
                        {summary.waitlisted} waitlisted
                      </Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </li>
            );
          })}
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
