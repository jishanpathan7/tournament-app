"use client";

import type { TournamentResponse } from "@tournament/api-client";
import { Archive, ChevronDown, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { useDeleteTournament, useTransitionStatus } from "@/features/tournaments/use-tournaments";
import { useCan } from "@/hooks/use-permissions";
import { toast } from "@/components/ui/sonner";
import { ACTIONS } from "@/lib/permissions";
import { errorMessage } from "@/lib/problem";

/**
 * Lifecycle + publish actions for a tournament. Transitions come from the config mirror
 * of the backend map; archive is the terminal state. Delete soft-removes the tournament
 * from the console and public microsite (requires `tournament:delete`).
 */
export function TournamentActions({ tournament }: { tournament: TournamentResponse }) {
  const router = useRouter();
  const can = useCan();
  const canManage = can(ACTIONS.TOURNAMENT_UPDATE);
  const canDelete = can(ACTIONS.TOURNAMENT_DELETE);
  const transition = useTransitionStatus(tournament.id);
  const deleteTournament = useDeleteTournament();
  const [pending, setPending] = useState<StatusTransition | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);

  if (!canManage && !canDelete) return null;

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

  const onDelete = () => {
    deleteTournament.mutate(tournament.id, {
      onSuccess: () => {
        toast.success("Tournament deleted");
        setDeleteOpen(false);
        router.push("/console/tournaments");
      },
      onError: (error) => toast.error(errorMessage(error, "Couldn't delete tournament")),
    });
  };

  return (
    <div className="flex items-center gap-2">
      {canManage ? (
        <Button tone="paper" size="sm" onClick={() => setPublishOpen(true)}>
          <Send className="h-4 w-4" strokeWidth={2.25} />
          Publish
        </Button>
      ) : null}

      {(canManage && (forward.length > 0 || archive)) || canDelete ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button tone="candy" size="sm">
              Actions
              <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {canManage ? (
              <>
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
              </>
            ) : null}
            {canDelete ? (
              <>
                {canManage ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem
                  onSelect={() => setDeleteOpen(true)}
                  className="text-pink-dark focus:bg-pink-tint focus:text-pink-dark"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2.25} />
                  Delete tournament
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

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

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete tournament?"
        description={`“${tournament.name}” will be removed from the console and public site. Registrations, draws, and scores are kept in the database but hidden.`}
        confirmLabel="Delete tournament"
        confirmTone="pink"
        loading={deleteTournament.isPending}
        onConfirm={onDelete}
      />

      {canManage ? (
        <PublishDialog tournament={tournament} open={publishOpen} onOpenChange={setPublishOpen} />
      ) : null}
    </div>
  );
}
