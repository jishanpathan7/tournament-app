"use client";

import type { MemberItem, ParticipantResponse, RegistrationResponse } from "@tournament/api-client";
import { Pencil } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { EditPlayerDialog } from "@/features/registrations/components/edit-player-dialog";
import { RegistrationRowActions } from "@/features/registrations/components/registration-row-actions";
import { SubmittedDetails } from "@/features/registrations/components/submitted-details";
import { TeamRoster } from "@/features/registrations/components/team-roster";
import { registrationEntrantLabel, statusMeta } from "@/features/registrations/config";

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-2xs font-mono font-semibold uppercase tracking-[0.16em]">
        {label}
      </dt>
      <dd className="text-sm font-semibold">{value}</dd>
    </div>
  );
}

/**
 * Full detail for one registration: who submitted it, what they submitted, the
 * resulting team roster (if approved into a pair/team), and the decision actions.
 * There's no audit-log endpoint yet, so "history" is just status + submitted date —
 * nothing fabricated beyond what the API actually returns.
 */
export function RegistrationDetailDialog({
  registration,
  divisionId,
  canManage,
  membersById,
  participant,
  open,
  onOpenChange,
}: {
  registration: RegistrationResponse | null;
  divisionId: string;
  canManage: boolean;
  membersById: Map<string, MemberItem>;
  participant: ParticipantResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);

  if (!registration) return null;
  const meta = statusMeta(registration.status);
  const canEdit = canManage && participant?.kind === "individual";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <DialogTitle className="text-xl">
                {registrationEntrantLabel(registration, membersById)}
              </DialogTitle>
              <Badge tone={meta.tone}>{meta.label}</Badge>
            </div>
          </DialogHeader>

          <dl className="grid grid-cols-2 gap-4">
            <MetaItem label="Skill level" value={registration.skillLevel ?? "—"} />
            <MetaItem
              label="Submitted"
              value={new Date(registration.createdAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            />
          </dl>

          <Separator />

          <div className="flex flex-col gap-2">
            <h3 className="font-serif text-lg font-semibold tracking-tight">Submitted details</h3>
            <SubmittedDetails formResponse={registration.formResponse} />
          </div>

          {participant?.teamId ? (
            <>
              <Separator />
              <div className="flex flex-col gap-2">
                <h3 className="font-serif text-lg font-semibold tracking-tight">Team</h3>
                <TeamRoster teamId={participant.teamId} />
              </div>
            </>
          ) : null}

          <Separator />
          <div className="flex items-center justify-between">
            {canEdit ? (
              <Button tone="paper" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit player
              </Button>
            ) : (
              <span />
            )}
            <RegistrationRowActions
              registration={registration}
              divisionId={divisionId}
              canManage={canManage}
              size="icon"
            />
          </div>
        </DialogContent>
      </Dialog>

      {canEdit && participant ? (
        <EditPlayerDialog
          participant={participant}
          divisionId={divisionId}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      ) : null}
    </>
  );
}
