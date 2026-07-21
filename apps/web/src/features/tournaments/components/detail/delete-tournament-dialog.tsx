"use client";

import type { TournamentResponse } from "@tournament/api-client";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { useDeleteTournament, usePurgeTournament } from "@/features/tournaments/use-tournaments";
import { errorMessage } from "@/lib/problem";

/**
 * Delete has two depths, and the difference matters enough to say out loud:
 *
 *  - **Delete** hides the tournament everywhere but keeps every row. Reversible by
 *    an engineer; the organizer just sees it disappear.
 *  - **Delete permanently** removes the data outright. Nothing brings it back.
 *
 * The permanent path is opt-in, asks for the name to be typed, and runs the soft
 * delete first because the backend only ever purges an already-deleted tournament.
 */
export function DeleteTournamentDialog({
  tournament,
  open,
  onOpenChange,
  onDeleted,
}: {
  tournament: TournamentResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const [permanent, setPermanent] = useState(false);
  const [typedName, setTypedName] = useState("");
  const deleteTournament = useDeleteTournament();
  const purgeTournament = usePurgeTournament();

  const pending = deleteTournament.isPending || purgeTournament.isPending;
  const nameMatches = typedName.trim() === tournament.name;

  const close = (next: boolean) => {
    if (!next) {
      setPermanent(false);
      setTypedName("");
    }
    onOpenChange(next);
  };

  const run = async () => {
    try {
      await deleteTournament.mutateAsync(tournament.id);
      if (permanent) {
        await purgeTournament.mutateAsync({ id: tournament.id, confirmName: typedName.trim() });
      }
      toast.success(permanent ? "Tournament permanently deleted" : "Tournament deleted");
      close(false);
      onDeleted();
    } catch (error) {
      // A failed purge leaves the tournament soft-deleted, not half-erased — say so,
      // rather than implying nothing happened.
      toast.error(
        errorMessage(error, permanent ? "Couldn't delete permanently" : "Couldn't delete"),
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete tournament?</DialogTitle>
        </DialogHeader>

        <p className="text-muted-foreground text-sm">
          “{tournament.name}” will be removed from the console and public site. Registrations,
          draws, and scores are kept in the database but hidden.
        </p>

        {permanent ? (
          <div className="border-pink bg-pink-tint flex flex-col gap-2 rounded-2xl border-2 p-3">
            <p className="text-ink text-sm font-semibold">
              This erases every division, participant, match and result. It cannot be undone.
            </p>
            <label className="text-muted-foreground text-xs" htmlFor="purge-confirm">
              Type <span className="text-ink font-semibold">{tournament.name}</span> to confirm
            </label>
            <Input
              id="purge-confirm"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={tournament.name}
              autoComplete="off"
            />
          </div>
        ) : (
          <Button
            type="button"
            tone="ghost"
            size="sm"
            className="self-start"
            onClick={() => setPermanent(true)}
          >
            Delete permanently instead
          </Button>
        )}

        <DialogFooter>
          <Button type="button" tone="paper" onClick={() => close(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            tone="pink"
            onClick={run}
            disabled={pending || (permanent && !nameMatches)}
          >
            {pending ? <Spinner className="h-4 w-4" /> : null}
            {permanent ? "Delete permanently" : "Delete tournament"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
