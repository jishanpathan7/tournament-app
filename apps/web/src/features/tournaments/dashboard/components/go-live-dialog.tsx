"use client";

import { CheckCircle2, Radio, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { Spinner } from "@/components/ui/spinner";
import type { StepSignals } from "@/features/tournaments/dashboard/config";
import { useTransitionStatus } from "@/features/tournaments/use-tournaments";
import { errorMessage } from "@/lib/problem";

interface CheckItem {
  label: string;
  passed: boolean;
  required: boolean;
}

function CheckRow({ item }: { item: CheckItem }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      {item.passed ? (
        <CheckCircle2 className="text-mint-dark h-4 w-4 shrink-0" strokeWidth={2.25} />
      ) : (
        <XCircle
          className={`h-4 w-4 shrink-0 ${item.required ? "text-pink-dark" : "text-yellow-500"}`}
          strokeWidth={2.25}
        />
      )}
      <span
        className={
          item.passed ? "" : item.required ? "text-foreground font-medium" : "text-muted-foreground"
        }
      >
        {item.label}
      </span>
      {!item.passed && !item.required ? (
        <span className="text-muted-foreground ml-auto text-xs">Optional</span>
      ) : null}
    </div>
  );
}

export function GoLiveDialog({
  tournamentId,
  open,
  onOpenChange,
  signals,
}: {
  tournamentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signals: StepSignals;
}) {
  const transition = useTransitionStatus(tournamentId);

  const checks: CheckItem[] = [
    {
      label: "Players approved",
      passed: signals.hasApproved,
      required: true,
    },
    {
      label: "Pairings generated",
      passed: signals.pairingPublished,
      required: false,
    },
    {
      label: "Check-in complete",
      passed: signals.checkInReady,
      required: false,
    },
    {
      label: "Draws generated for all divisions",
      passed: signals.drawComplete,
      required: true,
    },
    {
      label: "Courts configured and all matches scheduled",
      passed: signals.courtsReady,
      required: false,
    },
  ];

  const blockers = checks.filter((c) => c.required && !c.passed);
  const canGoLive = blockers.length === 0;

  function handleGoLive() {
    transition.mutate(
      { status: "live" },
      {
        onSuccess: () => {
          toast.success("Tournament is now live!");
          onOpenChange(false);
        },
        onError: (e) => toast.error(errorMessage(e, "Couldn't go live")),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Radio className="text-candy h-5 w-5" strokeWidth={2.25} />
            Go live checklist
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          <p className="text-muted-foreground text-sm">
            Review these items before starting the live tournament. Required items must pass before
            you can go live.
          </p>
          <div className="border-border flex flex-col gap-2.5 rounded-xl border p-4">
            {checks.map((c) => (
              <CheckRow key={c.label} item={c} />
            ))}
          </div>
          {!canGoLive ? (
            <p className="text-pink-dark text-sm font-medium">
              {blockers.length} required item{blockers.length > 1 ? "s" : ""} not complete. Fix
              {blockers.length > 1 ? " them" : " it"} before going live.
            </p>
          ) : (
            <p className="text-mint-dark text-sm font-medium">
              All required checks passed — ready to go live.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button tone="paper" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            tone="candy"
            size="sm"
            disabled={!canGoLive || transition.isPending}
            onClick={handleGoLive}
          >
            {transition.isPending ? (
              <Spinner className="text-white" />
            ) : (
              <Radio className="h-4 w-4" strokeWidth={2.25} />
            )}
            Go live
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
