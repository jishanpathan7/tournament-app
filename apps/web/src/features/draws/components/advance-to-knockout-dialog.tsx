"use client";

import { Trophy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { useAdvanceToKnockout } from "@/features/tournaments/use-tournaments";
import { errorMessage } from "@/lib/problem";

const TAKE_OPTIONS = [2, 4, 8, 16] as const;

export function AdvanceToKnockoutDialog({
  stageId,
  divisionId,
  open,
  onOpenChange,
  onSuccess,
}: {
  stageId: string;
  divisionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newStageId: string) => void;
}) {
  const [take, setTake] = useState<number>(4);
  const advance = useAdvanceToKnockout(stageId, divisionId);

  function handleConfirm() {
    advance.mutate(take, {
      onSuccess: (result) => {
        toast.success(`Knockout bracket created — ${result.matches} matches generated`);
        onOpenChange(false);
        onSuccess?.(result.stage_id);
      },
      onError: (e) => toast.error(errorMessage(e, "Couldn't advance to knockout")),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" strokeWidth={2.25} />
            Advance to Knockout
          </DialogTitle>
          <DialogDescription>
            Takes the top-ranked participants from this stage and generates a single-elimination
            bracket.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          <Label htmlFor="take-select">Participants to advance</Label>
          <Select value={String(take)} onValueChange={(v) => setTake(Number(v))}>
            <SelectTrigger id="take-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TAKE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  Top {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Seeded by current standings rank. A balanced bracket sized to the next power of two is
            generated (byes auto-resolved).
          </p>
        </div>

        <DialogFooter>
          <Button tone="paper" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button tone="candy" size="sm" disabled={advance.isPending} onClick={handleConfirm}>
            {advance.isPending ? "Creating…" : "Create bracket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
