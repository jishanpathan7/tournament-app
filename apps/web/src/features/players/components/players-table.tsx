"use client";

import type { ParticipantResponse } from "@tournament/api-client";
import type { KeyboardEvent } from "react";
import { Check, Minus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  playerInitials,
  playerStatusLabel,
  type PlayerRow,
} from "@/features/players/players-config";
import { statusMeta } from "@/features/registrations/config";
import { cn } from "@/lib/utils";

function BoolCell({ value }: { value: boolean | null }) {
  if (value === true) {
    return (
      <span className="bg-mint/20 text-mint inline-flex h-7 w-7 items-center justify-center rounded-full">
        <Check className="h-4 w-4" strokeWidth={2.5} aria-label="Yes" />
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="text-muted-foreground inline-flex h-7 w-7 items-center justify-center">
        <Minus className="h-4 w-4" aria-label="No" />
      </span>
    );
  }
  return <span className="text-muted-foreground text-sm">—</span>;
}

function openOnKey(onOpen: () => void) {
  return (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  };
}

export function PlayersTable({
  rows,
  onOpen,
  canManage,
  participantsByDivision,
}: {
  rows: PlayerRow[];
  onOpen: (row: PlayerRow) => void;
  canManage?: boolean;
  participantsByDivision?: Map<string, ParticipantResponse[]>;
}) {
  const [editingParticipant, setEditingParticipant] = useState<ParticipantResponse | null>(null);
  const [editingDivisionId, setEditingDivisionId] = useState<string>("");
  const [removingParticipant, setRemovingParticipant] = useState<ParticipantResponse | null>(null);
  const [removingDivisionId, setRemovingDivisionId] = useState<string>("");

  function getParticipant(row: PlayerRow): ParticipantResponse | null {
    if (!row.participantId || !participantsByDivision) return null;
    return (
      participantsByDivision.get(row.divisionId)?.find((p) => p.id === row.participantId) ?? null
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Player</TableHead>
            <TableHead>Skill</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Check-in</TableHead>
            {canManage ? <TableHead className="w-10" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const meta = statusMeta(row.status);
            const checkedIn = row.attendance === "checked_in";
            const participant = getParticipant(row);
            return (
              <TableRow
                key={row.id}
                tabIndex={0}
                className="cursor-pointer"
                onClick={() => onOpen(row)}
                onKeyDown={openOnKey(() => onOpen(row))}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs font-semibold">
                        {playerInitials(row.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.displayName}</p>
                      <p className="text-muted-foreground truncate text-xs">{row.divisionName}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="capitalize">{row.skillLevel ?? "—"}</TableCell>
                <TableCell>
                  <Badge tone={meta.tone}>{playerStatusLabel(row.status)}</Badge>
                </TableCell>
                <TableCell>
                  <BoolCell value={checkedIn ? true : row.status === "approved" ? false : null} />
                </TableCell>
                {canManage ? (
                  <TableCell
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    {participant ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Player actions</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingParticipant(participant);
                              setEditingDivisionId(row.divisionId);
                            }}
                          >
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Edit player
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setRemovingParticipant(participant);
                              setRemovingDivisionId(row.divisionId);
                            }}
                            className="text-pink focus:text-pink"
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Remove player
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <EditPlayerDialog
        participant={editingParticipant}
        divisionId={editingDivisionId}
        open={!!editingParticipant}
        onOpenChange={(open) => {
          if (!open) setEditingParticipant(null);
        }}
      />
      <RemovePlayerDialog
        participant={removingParticipant}
        divisionId={removingDivisionId}
        open={!!removingParticipant}
        onOpenChange={(open) => {
          if (!open) setRemovingParticipant(null);
        }}
      />
    </>
  );
}

export function PlayerFilterPills({
  skill,
  onSkillChange,
}: {
  skill: "all" | "beginner" | "intermediate" | "advanced";
  onSkillChange: (skill: "all" | "beginner" | "intermediate" | "advanced") => void;
}) {
  const options = [
    { value: "all" as const, label: "All" },
    { value: "beginner" as const, label: "Beginner" },
    { value: "intermediate" as const, label: "Intermediate" },
    { value: "advanced" as const, label: "Advanced" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onSkillChange(opt.value)}
          className={cn(
            "text-2xs rounded-full border-2 px-3 py-1 font-mono font-semibold uppercase tracking-[0.14em] transition-colors",
            skill === opt.value
              ? "border-ink bg-ink text-white"
              : "border-ink/20 hover:border-ink/40",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
