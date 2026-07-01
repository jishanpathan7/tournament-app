"use client";

import type { TournamentResponse } from "@tournament/api-client";
import { Check } from "lucide-react";
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
import { PUBLISH_ARTIFACTS } from "@/features/tournaments/config";
import { usePublishTournament } from "@/features/tournaments/use-tournaments";
import { errorMessage } from "@/lib/problem";

/** Publish public artifacts (draw/schedule/results). Shows what's already live. */
export function PublishDialog({
  tournament,
  open,
  onOpenChange,
}: {
  tournament: TournamentResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const publish = usePublishTournament(tournament.id);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const submit = () => {
    publish.mutate(
      { artifacts: [...selected] },
      {
        onSuccess: () => {
          toast.success("Published");
          setSelected(new Set());
          onOpenChange(false);
        },
        onError: (error) => toast.error(errorMessage(error, "Publish failed")),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Publish artifacts</DialogTitle>
          <DialogDescription>
            Make these visible on the public microsite. Re-publishing refreshes them.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {PUBLISH_ARTIFACTS.map((a) => {
            const published = !!tournament[a.field];
            const checked = selected.has(a.key);
            return (
              <label
                key={a.key}
                className="border-border hover:bg-muted flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 p-3"
              >
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="accent-candy h-4 w-4"
                    checked={checked}
                    onChange={() => toggle(a.key)}
                  />
                  <span className="text-sm font-semibold">{a.label}</span>
                </span>
                {published ? (
                  <span className="text-mint-dark text-2xs flex items-center gap-1 font-mono font-semibold uppercase tracking-[0.16em]">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Live
                  </span>
                ) : (
                  <span className="text-muted-foreground text-2xs font-mono uppercase tracking-[0.16em]">
                    Draft
                  </span>
                )}
              </label>
            );
          })}
        </div>
        <DialogFooter className="mt-2">
          <Button
            tone="paper"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={publish.isPending}
          >
            Cancel
          </Button>
          <Button
            tone="candy"
            size="sm"
            onClick={submit}
            disabled={publish.isPending || selected.size === 0}
          >
            {publish.isPending ? <Spinner className="text-white" /> : null}
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
