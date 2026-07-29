"use client";

import type { ParticipantResponse } from "@tournament/api-client";
import { AlertTriangle, Ban } from "lucide-react";
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

  const hasMatchResults = participant.hasMatchResults;
  const hasPublishedPair = participant.hasPublishedPair;
  const hasTeam = !!participant.teamId && !hasPublishedPair;

  // Blocked states: show info + close only, no destructive confirm button.
  const isBlocked = hasMatchResults || hasPublishedPair;

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
        } else if (code === "has_published_pair") {
          toast.error("Regenerate pairings first, then remove the player");
        } else if (code === "has_match_results") {
          toast.error("Cannot remove a player who has match results");
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
            tournament?{!isBlocked && " This cannot be undone."}
          </p>

          {hasMatchResults && (
            <div className="bg-destructive/10 border-destructive/30 flex items-start gap-2 rounded-xl border p-3">
              <Ban className="text-destructive mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} />
              <p className="text-sm">
                This player has match results recorded. Removal is blocked — results must be
                preserved for standings integrity.
              </p>
            </div>
          )}

          {!hasMatchResults && hasPublishedPair && (
            <div className="bg-destructive/10 border-destructive/30 flex items-start gap-2 rounded-xl border p-3">
              <Ban className="text-destructive mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} />
              <p className="text-sm">
                This player is in a published pair. Regenerate pairings first, then remove the
                player.
              </p>
            </div>
          )}

          {hasTeam && (
            <div className="bg-yellow/10 border-yellow/30 flex items-start gap-2 rounded-xl border p-3">
              <AlertTriangle className="text-yellow mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} />
              <p className="text-sm">
                This player is assigned to a team. Removing them will leave that team short one
                player.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            tone="paper"
            onClick={() => onOpenChange(false)}
            disabled={remove.isPending}
          >
            {isBlocked ? "Close" : "Cancel"}
          </Button>
          {!isBlocked && (
            <Button type="button" tone="pink" onClick={handleConfirm} disabled={remove.isPending}>
              {remove.isPending ? "Removing…" : "Remove player"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
