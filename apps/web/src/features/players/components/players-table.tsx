"use client";

import type { KeyboardEvent } from "react";
import { Check, Minus } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
}: {
  rows: PlayerRow[];
  onOpen: (row: PlayerRow) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Player</TableHead>
          <TableHead>Skill</TableHead>
          <TableHead>Gender</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Check-in</TableHead>
          <TableHead>Paid</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const meta = statusMeta(row.status);
          const checkedIn = row.attendance === "checked_in";
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
              <TableCell>{row.gender ?? "—"}</TableCell>
              <TableCell>
                <Badge tone={meta.tone}>{playerStatusLabel(row.status)}</Badge>
              </TableCell>
              <TableCell>
                <BoolCell value={checkedIn ? true : row.status === "approved" ? false : null} />
              </TableCell>
              <TableCell>
                <BoolCell value={row.paid} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
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
