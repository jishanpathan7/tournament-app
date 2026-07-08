"use client";

import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { useQueries } from "@tanstack/react-query";
import { ChevronDown, Dices, MoreHorizontal, Users, Wand2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { getPairing } from "@/features/pairing/pairing-api";
import { SquadCard } from "@/features/squads/components/squad-card";
import { SquadPairingSheet } from "@/features/squads/components/squad-pairing-sheet";
import { UnassignedPool } from "@/features/squads/components/unassigned-pool";
import { WorkflowProgress } from "@/features/squads/components/workflow-progress";
import {
  TEAM_COUNT_PRESETS,
  computeWorkflowState,
  pairingStatusFromRun,
  type SquadPairingStatus,
} from "@/features/squads/config";
import type { SquadView } from "@/features/squads/types";
import {
  useAssignSquadMember,
  useAutoDistributeSquads,
  useCreateSquad,
  useRemoveSquadMember,
  useSquads,
  useUpdateSquad,
} from "@/features/squads/use-squads";
import { useDivisions } from "@/features/tournaments/use-tournaments";
import { useCan } from "@/hooks/use-permissions";
import { queryKeys } from "@/lib/query-keys";
import { ACTIONS } from "@/lib/permissions";
import { errorMessage } from "@/lib/problem";

/** Franchise team board — assign registrations to balanced squads before pairing. */
export function TeamsBoard({ tournamentId }: { tournamentId: string }) {
  const can = useCan();
  const canManage = can(ACTIONS.TOURNAMENT_UPDATE);

  const squads = useSquads(tournamentId);
  const createSquad = useCreateSquad(tournamentId);
  const autoDistribute = useAutoDistributeSquads(tournamentId);
  const assign = useAssignSquadMember(tournamentId);
  const remove = useRemoveSquadMember(tournamentId);
  const updateSquad = useUpdateSquad(tournamentId);

  const [selectedRegistrationId, setSelectedRegistrationId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [pairingSquad, setPairingSquad] = useState<SquadView | null>(null);
  const [expandedSquadIds, setExpandedSquadIds] = useState<Set<string>>(new Set());
  const [setupOpen, setSetupOpen] = useState(false);

  const divisions = useDivisions(tournamentId);
  const firstDivisionId = divisions.data?.[0]?.id ?? null;

  const board = squads.data;
  const squadIds = board?.squads.map((s) => s.id) ?? [];

  const pairingQueries = useQueries({
    queries: squadIds.map((squadId) => ({
      queryKey: queryKeys.divisions.pairing(firstDivisionId ?? "", squadId),
      queryFn: () => getPairing(firstDivisionId!, squadId),
      enabled: !!firstDivisionId,
    })),
  });

  const pairingBySquadId = useMemo(() => {
    const map = new Map<string, { status: SquadPairingStatus; pairCount: number }>();
    squadIds.forEach((squadId, index) => {
      const query = pairingQueries[index];
      const run = query?.data ?? null;
      map.set(squadId, {
        status: pairingStatusFromRun(run, query?.isLoading ?? false),
        pairCount: run?.teams.length ?? 0,
      });
    });
    return map;
  }, [squadIds, pairingQueries]);

  const pairingStatusMap = useMemo(() => {
    const map = new Map<string, SquadPairingStatus>();
    for (const [squadId, info] of pairingBySquadId) {
      map.set(squadId, info.status);
    }
    return map;
  }, [pairingBySquadId]);

  const workflow = useMemo(() => {
    if (!board) {
      return computeWorkflowState([], 0, pairingStatusMap);
    }
    return computeWorkflowState(board.squads, board.summary.unassigned, pairingStatusMap);
  }, [board, pairingStatusMap]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function onDragStart(e: DragStartEvent) {
    setDraggingId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setDraggingId(null);
    const registrationId = String(e.active.id);
    const targetId = e.over?.id ? String(e.over.id) : null;
    if (!targetId || !board) return;

    const currentSquad = board.squads.find((s) =>
      s.members.some((m) => m.registrationId === registrationId),
    );

    if (targetId === "unassigned") {
      if (currentSquad) {
        remove.mutate(
          { squadId: currentSquad.id, registrationId },
          { onError: (err) => toast.error(errorMessage(err, "Couldn't remove player")) },
        );
      }
      return;
    }

    if (currentSquad?.id === targetId) return;
    if (currentSquad) {
      remove.mutate(
        { squadId: currentSquad.id, registrationId },
        {
          onSuccess: () =>
            assign.mutate(
              { squadId: targetId, registrationId },
              { onError: (err) => toast.error(errorMessage(err, "Couldn't assign player")) },
            ),
          onError: (err) => toast.error(errorMessage(err, "Couldn't move player")),
        },
      );
    } else {
      assign.mutate(
        { squadId: targetId, registrationId },
        { onError: (err) => toast.error(errorMessage(err, "Couldn't assign player")) },
      );
    }
  }

  const busy =
    createSquad.isPending ||
    autoDistribute.isPending ||
    assign.isPending ||
    remove.isPending ||
    updateSquad.isPending;

  function onAutoDistribute(count: number) {
    autoDistribute.mutate(
      { teamCount: count, replaceExisting: true },
      {
        onSuccess: (res) =>
          toast.success(`Balanced ${res.summary.assigned} players across ${count} teams`),
        onError: (err) => toast.error(errorMessage(err, "Couldn't auto-assign teams")),
      },
    );
  }

  function onAssignToSquad(squadId: string) {
    if (!selectedRegistrationId) return;
    assign.mutate(
      { squadId, registrationId: selectedRegistrationId },
      {
        onSuccess: () => {
          toast.success("Player assigned");
          setSelectedRegistrationId(null);
        },
        onError: (err) => toast.error(errorMessage(err, "Couldn't assign player")),
      },
    );
  }

  function onSelectRegistration(registrationId: string) {
    setSelectedRegistrationId((prev) => (prev === registrationId ? null : registrationId));
  }

  function toggleSquadExpanded(squadId: string) {
    setExpandedSquadIds((prev) => {
      const next = new Set(prev);
      if (next.has(squadId)) next.delete(squadId);
      else next.add(squadId);
      return next;
    });
  }

  function expandAll() {
    if (!board) return;
    setExpandedSquadIds(new Set(board.squads.map((s) => s.id)));
  }

  function collapseAll() {
    setExpandedSquadIds(new Set());
  }

  function openNextUnpairedSquad() {
    if (workflow.nextSquad) {
      setPairingSquad(workflow.nextSquad);
    }
  }

  function openRemainingPairingQueue() {
    if (!board) return;
    const next = board.squads.find((s) => {
      const status = pairingStatusMap.get(s.id);
      return status === "none" || status === "draft";
    });
    if (next) setPairingSquad(next);
    else toast.info("All teams already have published pairs");
  }

  const setupActions = canManage ? (
    <DropdownMenu open={setupOpen} onOpenChange={setSetupOpen}>
      <DropdownMenuTrigger asChild>
        <Button tone="paper" size="sm">
          <MoreHorizontal className="h-4 w-4" />
          Setup
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <Link href={`/console/tournaments/${tournamentId}/draft-ceremony`}>
            <Dices className="h-4 w-4" />
            Draft Ceremony
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {TEAM_COUNT_PRESETS.map((count) => (
          <DropdownMenuItem key={count} disabled={busy} onClick={() => onAutoDistribute(count)}>
            <Wand2 className="h-4 w-4" />
            Auto {count} teams
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={busy}
          onClick={() =>
            createSquad.mutate(
              { name: `Team ${(board?.squads.length ?? 0) + 1}` },
              {
                onSuccess: () => toast.success("Team created"),
                onError: (err) => toast.error(errorMessage(err, "Couldn't create team")),
              },
            )
          }
        >
          + Add team
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  if (squads.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (squads.isError) {
    return (
      <ErrorState
        error={squads.error}
        onRetry={() => squads.refetch()}
        title="Couldn't load teams"
      />
    );
  }

  if (!board) return null;

  const hasUnassigned = board.summary.unassigned > 0;
  const remainingPairingCount = board.squads.filter((s) => {
    const status = pairingStatusMap.get(s.id);
    return status === "none" || status === "draft";
  }).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Pre-pairing"
        title="Teams"
        description="Split participants into balanced franchise teams before doubles pairing or draw generation."
        actions={setupActions}
      />

      <WorkflowProgress
        workflow={workflow}
        tournamentId={tournamentId}
        assigned={board.summary.assigned}
        onNextAction={workflow.nextSquad ? openNextUnpairedSquad : undefined}
      />

      {board.squads.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {workflow.playersAssigned && remainingPairingCount > 0 && canManage ? (
            <Button tone="candy" size="sm" onClick={openRemainingPairingQueue}>
              Generate remaining pairs ({remainingPairingCount})
            </Button>
          ) : null}
          <Button tone="paper" size="sm" onClick={expandAll}>
            Expand all
          </Button>
          <Button tone="paper" size="sm" onClick={collapseAll}>
            Collapse all
          </Button>
        </div>
      ) : null}

      {selectedRegistrationId ? (
        <p className="text-candy-dark text-sm font-semibold">
          Select a team to assign the highlighted player, or click again to cancel.
        </p>
      ) : null}

      {board.squads.length === 0 && board.unassigned.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No eligible registrations yet"
          description="Import or approve registrations first, then auto-assign teams or add them manually."
        />
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div
            className={
              hasUnassigned
                ? "grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
                : "flex flex-col gap-4"
            }
          >
            {hasUnassigned ? (
              <UnassignedPool
                entries={board.unassigned}
                selectedId={selectedRegistrationId}
                onSelect={canManage ? onSelectRegistration : undefined}
              />
            ) : null}

            <div
              className={
                hasUnassigned
                  ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3"
                  : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              }
            >
              {board.squads.map((squad) => {
                const pairingInfo = pairingBySquadId.get(squad.id) ?? {
                  status: "loading" as const,
                  pairCount: 0,
                };
                return (
                  <SquadCard
                    key={squad.id}
                    squad={squad}
                    expanded={expandedSquadIds.has(squad.id)}
                    onToggleExpand={() => toggleSquadExpanded(squad.id)}
                    canManage={canManage}
                    divisionId={firstDivisionId}
                    pairingStatus={pairingInfo.status}
                    pairCount={pairingInfo.pairCount}
                    highlightAssign={!!selectedRegistrationId}
                    onAssign={() => onAssignToSquad(squad.id)}
                    onRemove={(registrationId) =>
                      remove.mutate(
                        { squadId: squad.id, registrationId },
                        {
                          onError: (err) =>
                            toast.error(errorMessage(err, "Couldn't remove player")),
                        },
                      )
                    }
                    onSetCaptain={(registrationId) =>
                      updateSquad.mutate(
                        { squadId: squad.id, captainRegistrationId: registrationId },
                        {
                          onSuccess: () => toast.success("Captain updated"),
                          onError: (err) => toast.error(errorMessage(err, "Couldn't set captain")),
                        },
                      )
                    }
                    onRename={(name) =>
                      updateSquad.mutate(
                        { squadId: squad.id, name },
                        {
                          onError: (err) => toast.error(errorMessage(err, "Couldn't rename team")),
                        },
                      )
                    }
                    onOpenPairing={() => setPairingSquad(squad)}
                  />
                );
              })}
            </div>
          </div>

          <DragOverlay>
            {draggingId ? (
              <div className="bg-card border-candy shadow-sticker-candy rounded-xl border-2 px-3 py-2 text-sm font-semibold opacity-90">
                {(() => {
                  const all = [
                    ...board.unassigned.map((u) => ({ id: u.registrationId, name: u.displayName })),
                    ...board.squads.flatMap((s) =>
                      s.members.map((m) => ({ id: m.registrationId, name: m.displayName })),
                    ),
                  ];
                  return all.find((p) => p.id === draggingId)?.name ?? draggingId;
                })()}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {board.squads.length === 0 && board.unassigned.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Get started</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Open <strong>Setup</strong> and use <strong>Auto 4 teams</strong> (or 6 / 8) to
            snake-draft players by skill level, or add teams manually and click players to assign
            them.
          </CardContent>
        </Card>
      ) : null}

      {pairingSquad && firstDivisionId ? (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setPairingSquad(null)}
          />
          <div className="bg-background relative ml-auto h-full w-full max-w-lg overflow-hidden shadow-2xl">
            <SquadPairingSheet
              squad={pairingSquad}
              divisionId={firstDivisionId}
              tournamentId={tournamentId}
              onClose={() => setPairingSquad(null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
