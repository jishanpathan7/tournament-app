"use client";

import { LayoutGrid, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BulkCreateCourtsDialog } from "@/features/courts/components/bulk-create-courts-dialog";
import { CreateCourtDialog } from "@/features/courts/components/create-court-dialog";
import { courtStatusMeta } from "@/features/courts/config";
import {
  useAssignCourt,
  useBulkRemoveCourts,
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
  const bulkRemove = useBulkRemoveCourts(tournamentId);
  const assignCourt = useAssignCourt(tournamentId);

  const [createOpen, setCreateOpen] = useState(false);
  const [bulkCreateOpen, setBulkCreateOpen] = useState(false);
  const [assignSelection, setAssignSelection] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const assignedCourtIds = new Set((assigned.data ?? []).map((a) => a.court.id));
  const unassignedCourts = (allCourts.data ?? []).filter((c) => !assignedCourtIds.has(c.id));

  const toggleSelect = (courtId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(courtId)) next.delete(courtId);
      else next.add(courtId);
      return next;
    });
  };

  const toggleAll = () => {
    const rows = assigned.data ?? [];
    if (selected.size === rows.length && rows.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.court.id)));
    }
  };

  const handleBulkRemove = () => {
    const courtIds = [...selected];
    bulkRemove.mutate(courtIds, {
      onSuccess: (result) => {
        setSelected(new Set());
        toast.success(`Removed ${result.removed.length} courts`);
      },
      onError: (e) => toast.error(errorMessage(e, "Couldn't remove courts")),
    });
  };

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
            <div className="flex flex-wrap gap-2">
              <Button tone="paper" size="sm" onClick={() => setBulkCreateOpen(true)}>
                <Plus className="h-4 w-4" strokeWidth={2.25} />
                Add in bulk
              </Button>
              <Button tone="candy" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" strokeWidth={2.25} />
                Add court
              </Button>
            </div>
          ) : undefined
        }
      />

      {canManage && selected.size > 0 ? (
        <div className="border-ink bg-lavender/40 flex flex-wrap items-center gap-3 rounded-2xl border-2 p-4">
          <span className="text-sm font-medium">
            {selected.size} court{selected.size === 1 ? "" : "s"} selected
          </span>
          <Button
            tone="ghost"
            size="sm"
            onClick={() => setSelected(new Set())}
            disabled={bulkRemove.isPending}
          >
            Clear
          </Button>
          <Button tone="paper" size="sm" onClick={handleBulkRemove} disabled={bulkRemove.isPending}>
            <Trash2 className="h-4 w-4" />
            Remove selected
          </Button>
        </div>
      ) : null}

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
          description="Add courts in bulk (e.g. Court 1–8) or one at a time to start scheduling matches."
          action={
            canManage ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button tone="paper" size="sm" onClick={() => setBulkCreateOpen(true)}>
                  <Plus className="h-4 w-4" strokeWidth={2.25} />
                  Add in bulk
                </Button>
                <Button tone="candy" size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" strokeWidth={2.25} />
                  Add court
                </Button>
              </div>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {canManage ? (
                <TableHead className="w-10">
                  <Checkbox
                    checked={selected.size === rows.length && rows.length > 0}
                    onCheckedChange={toggleAll}
                    aria-label="Select all courts"
                  />
                </TableHead>
              ) : null}
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
                  {canManage ? (
                    <TableCell>
                      <Checkbox
                        checked={selected.has(row.court.id)}
                        onCheckedChange={() => toggleSelect(row.court.id)}
                        aria-label={`Select ${row.court.name}`}
                      />
                    </TableCell>
                  ) : null}
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
                        <SelectTrigger className="h-8 w-40" aria-label={`${row.court.name} status`}>
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
                            onSuccess: () => {
                              setSelected((prev) => {
                                if (!prev.has(row.court.id)) return prev;
                                const next = new Set(prev);
                                next.delete(row.court.id);
                                return next;
                              });
                            },
                            onError: (e) => toast.error(errorMessage(e, "Couldn't remove court")),
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

      <CreateCourtDialog
        tournamentId={tournamentId}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      <BulkCreateCourtsDialog
        tournamentId={tournamentId}
        open={bulkCreateOpen}
        onOpenChange={setBulkCreateOpen}
      />
    </div>
  );
}
