"use client";

import { LayoutGrid, Plus } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateCourtDialog } from "@/features/courts/components/create-court-dialog";
import { courtStatusMeta } from "@/features/courts/config";
import {
  useAssignCourt,
  useCourts,
  useTournamentCourts,
  useUnassignCourt,
  useUpdateCourt,
} from "@/features/courts/use-courts";
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";
import { errorMessage } from "@/lib/problem";

export function CourtManagement({ tournamentId }: { tournamentId: string }) {
  const can = useCan();
  const canManage = can(ACTIONS.SCHEDULE_MANAGE);

  const assigned = useTournamentCourts(tournamentId);
  const allCourts = useCourts();
  const updateCourt = useUpdateCourt();
  const unassignCourt = useUnassignCourt(tournamentId);
  const assignCourt = useAssignCourt(tournamentId);

  const [createOpen, setCreateOpen] = useState(false);
  const [assignSelection, setAssignSelection] = useState("");

  const assignedCourtIds = new Set((assigned.data ?? []).map((a) => a.court.id));
  const unassignedCourts = (allCourts.data ?? []).filter((c) => !assignedCourtIds.has(c.id));

  if (assigned.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (assigned.isError) {
    return <ErrorState error={assigned.error} onRetry={() => assigned.refetch()} />;
  }

  const rows = assigned.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Operations"
        title="Courts"
        description="Courts assigned to this tournament — scheduling only places matches on courts listed here."
        actions={
          canManage ? (
            <Button tone="candy" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" strokeWidth={2.25} />
              Add court
            </Button>
          ) : undefined
        }
      />

      {canManage && unassignedCourts.length > 0 ? (
        <div className="border-ink bg-card shadow-sticker-xs flex flex-wrap items-center gap-3 rounded-2xl border-2 p-4">
          <span className="text-sm font-medium">Assign an existing court</span>
          <Select value={assignSelection} onValueChange={setAssignSelection}>
            <SelectTrigger className="w-56" aria-label="Choose a court to assign">
              <SelectValue placeholder="Choose a court" />
            </SelectTrigger>
            <SelectContent>
              {unassignedCourts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.venueName} · {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            tone="paper"
            size="sm"
            disabled={!assignSelection || assignCourt.isPending}
            onClick={() => {
              assignCourt.mutate(
                { courtId: assignSelection },
                {
                  onSuccess: () => setAssignSelection(""),
                  onError: (e) => toast.error(errorMessage(e, "Couldn't assign court")),
                },
              );
            }}
          >
            Assign
          </Button>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          eyebrow="No courts yet"
          title="Assign courts to schedule matches"
          description="Add a court (and its venue) to start assigning matches to courts and times."
          action={
            canManage ? (
              <Button tone="candy" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" strokeWidth={2.25} />
                Add court
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Court</TableHead>
              <TableHead>Venue</TableHead>
              <TableHead>Status</TableHead>
              {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const meta = courtStatusMeta(row.court.status);
              return (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.court.name}</TableCell>
                  <TableCell className="text-muted-foreground">{row.court.venueName}</TableCell>
                  <TableCell>
                    {canManage ? (
                      <Select
                        value={row.court.status}
                        onValueChange={(status) => {
                          updateCourt.mutate(
                            { courtId: row.court.id, body: { status } },
                            {
                              onError: (e) => toast.error(errorMessage(e, "Couldn't update court")),
                            },
                          );
                        }}
                      >
                        <SelectTrigger
                          className="h-8 w-40"
                          aria-label={`${row.court.name} status`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="disabled">Disabled</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    )}
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      <Button
                        tone="ghost"
                        size="sm"
                        onClick={() => {
                          unassignCourt.mutate(row.court.id, {
                            onError: (e) =>
                              toast.error(errorMessage(e, "Couldn't remove court")),
                          });
                        }}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <CreateCourtDialog tournamentId={tournamentId} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
