"use client";

import { AlertTriangle, Shuffle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import type { DrawReadiness } from "@/features/draws/config";
import { getFormat } from "@/features/tournaments/config";
import { useGenerateDraw } from "@/features/tournaments/use-tournaments";
import { ApiError, errorMessage } from "@/lib/problem";

/** Confirmation + progress + validation-error surface for generating a stage's draw.
 * The backend engine decides the actual structure — this only confirms intent and
 * reports the outcome (or failure) back to the organizer. */
export function GenerateDrawDialog({
  stageId,
  divisionId,
  tournamentId,
  format,
  readiness,
  open,
  onOpenChange,
  onGenerated,
}: {
  stageId: string;
  divisionId: string;
  tournamentId: string;
  format: string;
  readiness: DrawReadiness;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated?: () => void;
}) {
  const generate = useGenerateDraw(stageId, divisionId, tournamentId);
  const [error, setError] = useState<string | null>(null);
  const [checkinWarning, setCheckinWarning] = useState<string | null>(null);
  const [overrideReadiness, setOverrideReadiness] = useState(false);
  const formatLabel = getFormat(format)?.label ?? format;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setError(null);
      setCheckinWarning(null);
      setOverrideReadiness(false);
    }
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

        {checkinWarning ? (
          <div className="border-yellow bg-yellow-tint text-ink flex flex-col gap-3 rounded-2xl border-2 p-4 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
              <p>{checkinWarning}</p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="override-readiness"
                checked={overrideReadiness}
                onCheckedChange={(v) => setOverrideReadiness(!!v)}
              />
              <Label htmlFor="override-readiness" className="cursor-pointer text-sm">
                Override — generate draw anyway without all check-ins
              </Label>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="border-pink bg-pink-tint text-ink rounded-2xl border-2 p-4 text-sm">
            {error}
          </p>
        ) : null}

        <p className="text-muted-foreground text-sm">
          This creates the full match schedule now. You won&apos;t be able to change the participant
          list without clearing the draw first.
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
            loading={generate.isPending}
            disabled={generate.isPending || (!!checkinWarning && !overrideReadiness)}
            onClick={() => {
              setError(null);
              generate.mutate(
                { overrideReadiness: overrideReadiness },
                {
                  onSuccess: (result) => {
                    toast.success(`Draw generated — ${result.matches} matches`);
                    handleOpenChange(false);
                    onGenerated?.();
                  },
                  onError: (e) => {
                    if (e instanceof ApiError && e.code === "checkin_incomplete") {
                      setCheckinWarning(e.message);
                    } else {
                      setError(errorMessage(e, "Couldn't generate draw"));
                      toast.error(errorMessage(e, "Couldn't generate draw"));
                    }
                  },
                },
              );
            }}
          >
            {!generate.isPending && <Shuffle className="h-4 w-4" strokeWidth={2.25} />}
            {generate.isPending ? "Generating draw…" : "Generate draw"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
