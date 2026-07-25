"use client";

import type { ParticipantResponse } from "@tournament/api-client";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRemoveParticipant } from "@/features/registrations/use-registrations";

export function RemovePlayerDialog({
  participant,
  divisionId,
  open,
  onOpenChange,
}: {
  participant: ParticipantResponse | null;
  divisionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const remove = useRemoveParticipant(divisionId);

  if (!participant) return null;

  const hasTeam = !!participant.teamId;

  async function handleConfirm() {
    if (!participant) return;
    await remove.mutateAsync(participant.id, {
      onSuccess: () => {
        toast.success(`${participant.displayName} removed from the tournament`);
        onOpenChange(false);
      },
      onError: (err: unknown) => {
        const code = (err as { response?: { data?: { code?: string; detail?: string } } })?.response
          ?.data?.code;
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail;
        if (code === "live_tournament") {
          toast.error("Cannot remove a player during a live tournament");
        } else {
          toast.error(detail ?? "Failed to remove player");
        }
        onOpenChange(false);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Remove player</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <p className="text-sm">
            Remove <span className="font-semibold">{participant.displayName}</span> from the
            tournament? This cannot be undone.
          </p>

          {hasTeam ? (
            <div className="bg-yellow/10 border-yellow/30 flex items-start gap-2 rounded-xl border p-3">
              <AlertTriangle className="text-yellow mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} />
              <p className="text-sm">
                This player is part of a team. Removing them will leave their team without a player.
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            tone="paper"
            onClick={() => onOpenChange(false)}
            disabled={remove.isPending}
          >
            Cancel
          </Button>
          <Button type="button" tone="pink" onClick={handleConfirm} disabled={remove.isPending}>
            {remove.isPending ? "Removing…" : "Remove player"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
