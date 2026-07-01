"use client";

import type { TournamentResponse } from "@tournament/api-client";
import { Archive, ChevronDown, Send } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STATUS_TRANSITIONS, type StatusTransition } from "@/features/tournaments/config";
import { PublishDialog } from "@/features/tournaments/components/detail/publish-dialog";
import { useTransitionStatus } from "@/features/tournaments/use-tournaments";
import { useCan } from "@/hooks/use-permissions";
import { toast } from "@/components/ui/sonner";
import { ACTIONS } from "@/lib/permissions";
import { errorMessage } from "@/lib/problem";

/**
 * Lifecycle + publish actions for a tournament. Transitions come from the config mirror
 * of the backend map; archive is the terminal state (there is no hard-delete endpoint).
 * Everything here is gated on `tournament:update` and reflects optimistically.
 */
export function TournamentActions({ tournament }: { tournament: TournamentResponse }) {
  const can = useCan();
  const transition = useTransitionStatus(tournament.id);
  const [pending, setPending] = useState<StatusTransition | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);

  if (!can(ACTIONS.TOURNAMENT_UPDATE)) return null;

  const transitions =
    STATUS_TRANSITIONS[tournament.status as keyof typeof STATUS_TRANSITIONS] ?? [];
  const archive = transitions.find((t) => t.to === "archived");
  const forward = transitions.filter((t) => t.to !== "archived");

  const runTransition = (t: StatusTransition) => {
    transition.mutate(
      { status: t.to },
      {
        onSuccess: () => toast.success(`${t.label} — done`),
        onError: (error) => toast.error(errorMessage(error, "Couldn't update status")),
      },
    );
    setPending(null);
  };

  return (
    <div className="flex items-center gap-2">
      <Button tone="paper" size="sm" onClick={() => setPublishOpen(true)}>
        <Send className="h-4 w-4" strokeWidth={2.25} />
        Publish
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button tone="candy" size="sm">
            Actions
            <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Lifecycle</DropdownMenuLabel>
          {forward.length === 0 && !archive ? (
            <DropdownMenuItem disabled>No actions available</DropdownMenuItem>
          ) : null}
          {forward.map((t) => (
            <DropdownMenuItem key={t.to} onSelect={() => setPending(t)}>
              {t.label}
            </DropdownMenuItem>
          ))}
          {archive ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setPending(archive)}
                className="text-pink-dark focus:bg-pink-tint focus:text-pink-dark"
              >
                <Archive className="h-4 w-4" strokeWidth={2.25} />
                Archive
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending?.label ?? ""}
        description={
          pending?.to === "archived"
            ? "Archiving makes the tournament read-only. This can't be undone."
            : `Move this tournament to “${pending?.to}”?`
        }
        confirmLabel={pending?.label ?? "Confirm"}
        confirmTone={pending?.regressive ? "pink" : "candy"}
        loading={transition.isPending}
        onConfirm={() => pending && runTransition(pending)}
      />

      <PublishDialog tournament={tournament} open={publishOpen} onOpenChange={setPublishOpen} />
    </div>
  );
}
