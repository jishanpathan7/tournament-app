"use client";

import { Shuffle } from "lucide-react";
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
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import type { DrawReadiness } from "@/features/draws/config";
import { getFormat } from "@/features/tournaments/config";
import { useGenerateDraw } from "@/features/tournaments/use-tournaments";
import { errorMessage } from "@/lib/problem";

/** Confirmation + progress + validation-error surface for generating a stage's draw.
 * The backend engine decides the actual structure — this only confirms intent and
 * reports the outcome (or failure) back to the organizer. */
export function GenerateDrawDialog({
  stageId,
  divisionId,
  format,
  readiness,
  open,
  onOpenChange,
  onGenerated,
}: {
  stageId: string;
  divisionId: string;
  format: string;
  readiness: DrawReadiness;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated?: () => void;
}) {
  const generate = useGenerateDraw(stageId, divisionId);
  const [error, setError] = useState<string | null>(null);
  const formatLabel = getFormat(format)?.label ?? format;

  const handleOpenChange = (next: boolean) => {
    if (!next) setError(null);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Generate draw</DialogTitle>
          <DialogDescription>
            {formatLabel} · {readiness.approvedCount} approved participant
            {readiness.approvedCount === 1 ? "" : "s"}
          </DialogDescription>
        </DialogHeader>

        {readiness.warnings.length > 0 ? (
          <ul className="border-yellow bg-yellow-tint text-ink flex flex-col gap-1.5 rounded-2xl border-2 p-4 text-sm">
            {readiness.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}

        {error ? (
          <p className="border-pink bg-pink-tint text-ink rounded-2xl border-2 p-4 text-sm">
            {error}
          </p>
        ) : null}

        <p className="text-muted-foreground text-sm">
          This creates the full match schedule now. You won&apos;t be able to change the
          participant list without clearing the draw first.
        </p>

        <DialogFooter className="mt-2">
          <Button
            type="button"
            tone="paper"
            size="sm"
            onClick={() => handleOpenChange(false)}
            disabled={generate.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            tone="candy"
            size="sm"
            disabled={generate.isPending}
            onClick={() => {
              setError(null);
              generate.mutate(
                {},
                {
                  onSuccess: (result) => {
                    toast.success(`Draw generated — ${result.matches} matches`);
                    handleOpenChange(false);
                    onGenerated?.();
                  },
                  onError: (e) => {
                    setError(errorMessage(e, "Couldn't generate draw"));
                    toast.error(errorMessage(e, "Couldn't generate draw"));
                  },
                },
              );
            }}
          >
            {generate.isPending ? <Spinner className="text-white" /> : <Shuffle className="h-4 w-4" strokeWidth={2.25} />}
            Generate draw
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
