"use client";

import type { ParticipantResponse } from "@tournament/api-client";
import { Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PARTICIPANT_STATUS } from "@/features/registrations/config";
import { TeamRoster } from "@/features/registrations/components/team-roster";
import { PARTICIPANT_KINDS } from "@/features/tournaments/config";

/** Approved roster for the division. Pair/team rows expose their partner roster via a popover. */
export function ParticipantsTable({ participants }: { participants: ParticipantResponse[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Participant</TableHead>
          <TableHead>Kind</TableHead>
          <TableHead>Seed</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {participants.map((p) => {
          const meta = PARTICIPANT_STATUS[p.status] ?? { label: p.status, tone: "muted" as const };
          return (
            <TableRow key={p.id}>
              <TableCell className="font-semibold">
                {p.teamId ? (
                  <Popover>
                    <PopoverTrigger className="flex items-center gap-1.5 underline-offset-2 hover:underline">
                      {p.displayName}
                      <Users className="text-muted-foreground h-3.5 w-3.5" strokeWidth={2.25} />
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-72 p-3">
                      <TeamRoster teamId={p.teamId} />
                    </PopoverContent>
                  </Popover>
                ) : (
                  p.displayName
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {PARTICIPANT_KINDS[p.kind as keyof typeof PARTICIPANT_KINDS] ?? p.kind}
              </TableCell>
              <TableCell className="text-muted-foreground font-mono tabular-nums">
                {p.seed ?? "—"}
              </TableCell>
              <TableCell>
                <Badge tone={meta.tone}>{meta.label}</Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
