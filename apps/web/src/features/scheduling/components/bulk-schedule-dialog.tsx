"use client";

import type { CourtView, MatchView } from "@tournament/api-client";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { DEFAULT_DURATION_MINUTES, toDatetimeLocalValue } from "@/features/scheduling/config";
import { useBulkAssignSchedule } from "@/features/scheduling/use-schedule";
import { errorMessage } from "@/lib/problem";

/** Auto-fills every unscheduled (bracket-resolved) match across the assigned active
 * courts, round-robin, back-to-back from a chosen start time — then submits the whole
 * batch as one all-or-nothing request. Meant for "lay out the whole day in one go";
 * individual matches can still be dragged/retimed afterward. */
export function BulkScheduleDialog({
  tournamentId,
  unscheduled,
  activeCourts,
  defaultStart,
  open,
  onOpenChange,
}: {
  tournamentId: string;
  unscheduled: MatchView[];
  activeCourts: CourtView[];
  defaultStart: Date;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const bulkAssign = useBulkAssignSchedule(tournamentId);
  const [startAt, setStartAt] = useState(() => toDatetimeLocalValue(defaultStart));
  const [duration, setDuration] = useState(DEFAULT_DURATION_MINUTES);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    setError(null);
    if (activeCourts.length === 0) {
      setError("Assign at least one active court first.");
      return;
    }
    if (unscheduled.length === 0) {
      setError("Nothing to schedule — every ready match already has a court and time.");
      return;
    }
    const start = new Date(startAt);
    const assignments = unscheduled.map((match, i) => {
      // `activeCourts.length === 0` returned above, so this index is always in bounds.
      const court = activeCourts[i % activeCourts.length]!;
      const slot = Math.floor(i / activeCourts.length);
      const scheduledAt = new Date(start.getTime() + slot * duration * 60_000);
      return {
        matchId: match.id,
        courtId: court.id,
        scheduledAt: scheduledAt.toISOString(),
        durationMinutes: duration,
      };
    });

    bulkAssign.mutate(
      { assignments },
      {
        onSuccess: (result) => {
          toast.success(`Scheduled ${result.results.length} matches`);
          onOpenChange(false);
        },
        onError: (e) => setError(errorMessage(e, "Couldn't bulk-schedule")),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Bulk schedule</DialogTitle>
          <DialogDescription>
            Fills {unscheduled.length} unscheduled match{unscheduled.length === 1 ? "" : "es"} across{" "}
            {activeCourts.length} active court{activeCourts.length === 1 ? "" : "s"}, round-robin.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bulk-start">Start time</Label>
            <Input
              id="bulk-start"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bulk-duration">Match duration (minutes)</Label>
            <Input
              id="bulk-duration"
              type="number"
              min={5}
              max={480}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) || DEFAULT_DURATION_MINUTES)}
            />
          </div>
          {error ? (
            <p className="border-pink bg-pink-tint text-ink rounded-2xl border-2 p-3 text-sm">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="mt-2">
          <Button tone="paper" size="sm" onClick={() => onOpenChange(false)} disabled={bulkAssign.isPending}>
            Cancel
          </Button>
          <Button tone="candy" size="sm" onClick={handleSubmit} disabled={bulkAssign.isPending}>
            {bulkAssign.isPending ? <Spinner className="text-white" /> : null}
            Schedule all
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
