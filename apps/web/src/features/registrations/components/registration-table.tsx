"use client";

import type { MemberItem, ParticipantResponse, RegistrationResponse } from "@tournament/api-client";
import type { KeyboardEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RegistrationRowActions } from "@/features/registrations/components/registration-row-actions";
import {
  formResponseSummary,
  registrationEntrantLabel,
  statusMeta,
} from "@/features/registrations/config";

function openOnKey(onOpen: () => void) {
  return (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  };
}

/**
 * The registration queue. Whole row opens the detail dialog (click, or Enter/Space when
 * focused); the checkbox and action buttons stop propagation so they don't also open it.
 */
export function RegistrationTable({
  registrations,
  divisionId,
  canManage,
  membersById,
  participantsByRegistrationId,
  selected,
  onToggleSelect,
  onToggleSelectAll,
  onOpen,
}: {
  registrations: RegistrationResponse[];
  divisionId: string;
  canManage: boolean;
  membersById: Map<string, MemberItem>;
  participantsByRegistrationId: Map<string, ParticipantResponse>;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onOpen: (registration: RegistrationResponse) => void;
}) {
  const allSelected = registrations.length > 0 && selected.size === registrations.length;
  const someSelected = selected.size > 0 && !allSelected;

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {canManage ? (
            <TableHead className="w-10">
              <Checkbox
                aria-label="Select all registrations"
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={onToggleSelectAll}
              />
            </TableHead>
          ) : null}
          <TableHead>Entrant</TableHead>
          <TableHead>Team / partner</TableHead>
          <TableHead>Skill</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Submitted</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {registrations.map((registration) => {
          const meta = statusMeta(registration.status);
          const participant = participantsByRegistrationId.get(registration.id) ?? null;
          return (
            <TableRow
              key={registration.id}
              tabIndex={0}
              role="button"
              aria-label={`Open registration from ${registrationEntrantLabel(registration, membersById)}`}
              className="focus-visible:bg-muted cursor-pointer outline-none"
              onClick={() => onOpen(registration)}
              onKeyDown={openOnKey(() => onOpen(registration))}
            >
              {canManage ? (
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    aria-label={`Select registration from ${registrationEntrantLabel(registration, membersById)}`}
                    checked={selected.has(registration.id)}
                    onCheckedChange={() => onToggleSelect(registration.id)}
                  />
                </TableCell>
              ) : null}
              <TableCell className="font-semibold">
                {registrationEntrantLabel(registration, membersById)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {participant?.displayName ?? formResponseSummary(registration.formResponse) ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {registration.skillLevel ?? "—"}
              </TableCell>
              <TableCell>
                <Badge tone={meta.tone}>{meta.label}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground font-mono text-xs tabular-nums">
                {new Date(registration.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end">
                  <RegistrationRowActions
                    registration={registration}
                    divisionId={divisionId}
                    canManage={canManage}
                  />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
