"use client";

import { Users, Wand2 } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { SquadColumn } from "@/features/squads/components/squad-column";
import { UnassignedPool } from "@/features/squads/components/unassigned-pool";
import { TEAM_COUNT_PRESETS } from "@/features/squads/config";
import {
  useAssignSquadMember,
  useAutoDistributeSquads,
  useCreateSquad,
  useRemoveSquadMember,
  useSquads,
  useUpdateSquad,
} from "@/features/squads/use-squads";
import { useCan } from "@/hooks/use-permissions";
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
        onError: (e) => toast.error(errorMessage(e, "Couldn't auto-assign teams")),
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
        onError: (e) => toast.error(errorMessage(e, "Couldn't assign player")),
      },
    );
  }

  function onSelectRegistration(registrationId: string) {
    setSelectedRegistrationId((prev) => (prev === registrationId ? null : registrationId));
  }

  const actions = canManage ? (
    <div className="flex flex-wrap items-center gap-2">
      {TEAM_COUNT_PRESETS.map((count) => (
        <Button
          key={count}
          tone="paper"
          size="sm"
          disabled={busy}
          onClick={() => onAutoDistribute(count)}
        >
          <Wand2 className="h-4 w-4" />
          Auto {count} teams
        </Button>
      ))}
      <Button
        tone="candy"
        size="sm"
        disabled={busy}
        onClick={() =>
          createSquad.mutate(
            { name: `Team ${(squads.data?.squads.length ?? 0) + 1}` },
            {
              onSuccess: () => toast.success("Team created"),
              onError: (e) => toast.error(errorMessage(e, "Couldn't create team")),
            },
          )
        }
      >
        + Add team
      </Button>
    </div>
  ) : null;

  if (squads.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
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

  const board = squads.data;
  if (!board) return null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Pre-pairing"
        title="Teams"
        description="Split participants into balanced franchise teams before doubles pairing or draw generation."
        actions={actions}
      />

      <Card className="bg-muted/30">
        <CardContent className="flex flex-wrap items-center gap-4 p-4 text-sm">
          <span>
            <strong>{board.summary.assigned}</strong> assigned
          </span>
          <span className="text-muted-foreground">·</span>
          <span>
            <strong>{board.summary.unassigned}</strong> unassigned
          </span>
          <span className="text-muted-foreground">·</span>
          <span>
            <strong>{board.summary.squadCount}</strong> teams
          </span>
          {board.summary.unassigned > 0 ? (
            <Badge tone="yellow">{board.summary.unassigned} need a team</Badge>
          ) : board.summary.squadCount > 0 ? (
            <Badge tone="mint">All assigned</Badge>
          ) : null}
        </CardContent>
      </Card>

      {selectedRegistrationId ? (
        <p className="text-candy-dark text-sm font-semibold">
          Select a team column to assign the highlighted player, or click again to cancel.
        </p>
      ) : null}

      {board.squads.length === 0 && board.unassigned.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No eligible registrations yet"
          description="Import or approve registrations first, then auto-assign teams or add them manually."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <UnassignedPool
            entries={board.unassigned}
            selectedId={selectedRegistrationId}
            onSelect={canManage ? onSelectRegistration : undefined}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
            {board.squads.map((squad) => (
              <SquadColumn
                key={squad.id}
                squad={squad}
                canManage={canManage}
                highlightAssign={!!selectedRegistrationId}
                onAssign={() => onAssignToSquad(squad.id)}
                onRemove={(registrationId) =>
                  remove.mutate(
                    { squadId: squad.id, registrationId },
                    {
                      onError: (e) => toast.error(errorMessage(e, "Couldn't remove player")),
                    },
                  )
                }
                onSetCaptain={(registrationId) =>
                  updateSquad.mutate(
                    { squadId: squad.id, captainRegistrationId: registrationId },
                    {
                      onSuccess: () => toast.success("Captain updated"),
                      onError: (e) => toast.error(errorMessage(e, "Couldn't set captain")),
                    },
                  )
                }
                onRename={(name) =>
                  updateSquad.mutate(
                    { squadId: squad.id, name },
                    {
                      onError: (e) => toast.error(errorMessage(e, "Couldn't rename team")),
                    },
                  )
                }
              />
            ))}
          </div>
        </div>
      )}

      {board.squads.length === 0 && board.unassigned.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Get started</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Use <strong>Auto 4 teams</strong> (or 6 / 8) to snake-draft players by skill level,
            or add teams manually and click players to assign them.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
