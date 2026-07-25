"use client";

import type { ParticipantResponse } from "@tournament/api-client";
import { MoreHorizontal, Pencil, Trash2, Users } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EditPlayerDialog } from "@/features/registrations/components/edit-player-dialog";
import { RemovePlayerDialog } from "@/features/registrations/components/remove-player-dialog";
import { PARTICIPANT_STATUS } from "@/features/registrations/config";
import { TeamRoster } from "@/features/registrations/components/team-roster";
import { PARTICIPANT_KINDS } from "@/features/tournaments/config";

/** Approved roster for the division. Pair/team rows expose their partner roster via a popover. */
export function ParticipantsTable({
  participants,
  divisionId,
  canManage,
}: {
  participants: ParticipantResponse[];
  divisionId: string;
  canManage?: boolean;
}) {
  const [editing, setEditing] = useState<ParticipantResponse | null>(null);
  const [removing, setRemoving] = useState<ParticipantResponse | null>(null);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Participant</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Seed</TableHead>
            <TableHead>Status</TableHead>
            {canManage ? <TableHead className="w-10" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {participants.map((p) => {
            const meta = PARTICIPANT_STATUS[p.status] ?? {
              label: p.status,
              tone: "muted" as const,
            };
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
                {canManage ? (
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Player actions</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditing(p)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Edit player
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setRemoving(p)}
                          className="text-pink focus:text-pink"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Remove player
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <EditPlayerDialog
        participant={editing}
        divisionId={divisionId}
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
      <RemovePlayerDialog
        participant={removing}
        divisionId={divisionId}
        open={!!removing}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
      />
    </>
  );
}
