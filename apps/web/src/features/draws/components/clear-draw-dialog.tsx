"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { useClearDraw } from "@/features/tournaments/use-tournaments";
import { errorMessage } from "@/lib/problem";

/** Confirms wiping a stage's draw so it can be regenerated. Only reachable when the
 * caller already knows `!stage.locked` — the backend still re-checks and 409s if any
 * match has since been scored, in which case we surface that instead of pretending it
 * worked. */
export function ClearDrawDialog({
  stageId,
  divisionId,
  open,
  onOpenChange,
}: {
  stageId: string;
  divisionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const clear = useClearDraw(stageId, divisionId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Clear draw</DialogTitle>
          <DialogDescription>
            This deletes every match, round, group, and standing this stage generated, so you can
            regenerate it from scratch. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-2">
          <Button
            type="button"
            tone="paper"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={clear.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            tone="pink"
            size="sm"
            disabled={clear.isPending}
            onClick={() =>
              clear.mutate(undefined, {
                onSuccess: () => {
                  toast.success("Draw cleared");
                  onOpenChange(false);
                },
                onError: (e) => toast.error(errorMessage(e, "Couldn't clear draw")),
              })
            }
          >
            {clear.isPending ? <Spinner /> : <Trash2 className="h-4 w-4" strokeWidth={2.25} />}
            Clear draw
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
