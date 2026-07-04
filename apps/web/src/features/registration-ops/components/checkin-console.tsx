"use client";

import type { ParticipantAttendanceView } from "@tournament/api-client";
import { ArrowLeft, Check, CheckSquare, Clock, Square, UserX } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { TableSkeleton } from "@/components/common/loading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import {
  useAttendance,
  useBulkSetAttendance,
  useSetAttendance,
} from "@/features/registration-ops/use-registration-ops";
import { CheckInLinkPanel } from "@/features/registration-ops/components/checkin-link-panel";
import { useDivisions } from "@/features/tournaments/use-tournaments";
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";
import { errorMessage } from "@/lib/problem";

type AttendanceStatus = "pending" | "checked_in" | "absent";

const STATUS_META: Record<AttendanceStatus, { label: string; tone: "muted" | "mint" | "pink" }> = {
  pending: { label: "Pending", tone: "muted" },
  checked_in: { label: "Checked in", tone: "mint" },
  absent: { label: "Absent", tone: "pink" },
};

function AttendanceBadge({ status }: { status: string }) {
  const meta = STATUS_META[status as AttendanceStatus] ?? { label: status, tone: "muted" as const };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function CheckInConsole({
  tournamentId,
  divisionId,
}: {
  tournamentId: string;
  divisionId: string;
}) {
  const can = useCan();
  const canManage = can(ACTIONS.TOURNAMENT_UPDATE);

  const divisions = useDivisions(tournamentId);
  const division = divisions.data?.find((d) => d.id === divisionId) ?? null;

  const attendance = useAttendance(divisionId);
  const setAttendanceMut = useSetAttendance(divisionId);
  const bulkAttendance = useBulkSetAttendance(divisionId, tournamentId);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const participants = useMemo(() => attendance.data ?? [], [attendance.data]);

  const counts = useMemo(
    () => ({
      checked_in: participants.filter((p) => p.attendance === "checked_in").length,
      pending: participants.filter((p) => p.attendance === "pending").length,
      absent: participants.filter((p) => p.attendance === "absent").length,
    }),
    [participants],
  );

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) =>
      prev.size === participants.length ? new Set() : new Set(participants.map((p) => p.id)),
    );

  const setOne = useCallback(
    (p: ParticipantAttendanceView, status: AttendanceStatus) => {
      setPendingIds((prev) => new Set([...prev, p.id]));
      setAttendanceMut.mutate(
        { participantId: p.id, body: { status } },
        {
          onSuccess: () =>
            toast.success(`${p.displayName} marked ${STATUS_META[status].label}`),
          onError: (e) => toast.error(errorMessage(e, "Couldn't update attendance")),
          onSettled: () =>
            setPendingIds((prev) => {
              const n = new Set(prev);
              n.delete(p.id);
              return n;
            }),
        },
      );
    },
    [setAttendanceMut],
  );

  const bulkSet = (status: AttendanceStatus) => {
    const ids = [...selected];
    bulkAttendance.mutate(
      { participantIds: ids, status },
      {
        onSuccess: (r) => {
          toast.success(`${r.updated.length} participants marked ${STATUS_META[status].label}`);
          setSelected(new Set());
        },
        onError: (e) => toast.error(errorMessage(e, "Bulk update failed")),
      },
    );
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, p: ParticipantAttendanceView) => {
      if (!canManage) return;
      if (e.key === "c") {
        e.preventDefault();
        setOne(p, "checked_in");
      }
      if (e.key === "a") {
        e.preventDefault();
        setOne(p, "absent");
      }
      if (e.key === "p") {
        e.preventDefault();
        setOne(p, "pending");
      }
    },
    [canManage, setOne],
  );

  return (
    <div className="flex flex-col gap-6">
      <Button asChild tone="ghost" size="sm" className="text-muted-foreground -ml-2 self-start">
        <Link href={`/console/tournaments/${tournamentId}`}>
          <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
          Back to tournament
        </Link>
      </Button>

      <PageHeader
        eyebrow="Event day"
        title={`Check-in — ${division?.name ?? "…"}`}
        description="Mark participants as checked in, absent, or pending. Keyboard: C = checked in, A = absent, P = pending."
      />

      {canManage ? <CheckInLinkPanel divisionId={divisionId} /> : null}

      {/* Counts */}
      <div className="grid grid-cols-3 gap-3">
        {(["checked_in", "pending", "absent"] as const).map((s) => (
          <div key={s} className="rounded-2xl border border-border p-4 text-center">
            <p className="text-2xl font-bold">{counts[s]}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{STATUS_META[s].label}</p>
          </div>
        ))}
      </div>

      {/* Bulk action bar */}
      {canManage && selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-2xl border-2 border-candy bg-candy-tint px-4 py-2.5">
          <span className="text-sm font-medium mr-2">{selected.size} selected</span>
          <Button
            size="sm"
            tone="paper"
            onClick={() => bulkSet("checked_in")}
            disabled={bulkAttendance.isPending}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            Check in all
          </Button>
          <Button
            size="sm"
            tone="paper"
            onClick={() => bulkSet("absent")}
            disabled={bulkAttendance.isPending}
          >
            <UserX className="h-3.5 w-3.5" strokeWidth={2.5} />
            Mark absent
          </Button>
          <Button
            size="sm"
            tone="paper"
            onClick={() => bulkSet("pending")}
            disabled={bulkAttendance.isPending}
          >
            <Clock className="h-3.5 w-3.5" strokeWidth={2.5} />
            Reset pending
          </Button>
          <Button
            size="sm"
            tone="ghost"
            className="ml-auto text-muted-foreground"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {attendance.isLoading ? (
        <TableSkeleton rows={6} />
      ) : attendance.isError ? (
        <ErrorState error={attendance.error} onRetry={() => attendance.refetch()} />
      ) : participants.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No participants yet"
          description="Approved participants appear here once added to the division."
        />
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {canManage && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selected.size === participants.length && participants.length > 0}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                )}
                <TableHead>Participant</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Checked in at</TableHead>
                {canManage && <TableHead className="w-44">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.map((p) => (
                <TableRow
                  key={p.id}
                  tabIndex={canManage ? 0 : undefined}
                  onKeyDown={(e) => handleKeyDown(e, p)}
                  className={canManage ? "focus:outline-none focus:bg-muted/30" : ""}
                >
                  {canManage && (
                    <TableCell>
                      <Checkbox
                        checked={selected.has(p.id)}
                        onCheckedChange={() => toggleSelect(p.id)}
                        aria-label={`Select ${p.displayName}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{p.displayName}</TableCell>
                  <TableCell className="capitalize text-sm text-muted-foreground">
                    {p.kind}
                  </TableCell>
                  <TableCell>
                    <AttendanceBadge status={p.attendance} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.checkedInAt
                      ? new Date(p.checkedInAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      {pendingIds.has(p.id) ? (
                        <Spinner className="h-4 w-4" />
                      ) : (
                        <div className="flex items-center gap-1">
                          {p.attendance !== "checked_in" && (
                            <Button
                              size="sm"
                              tone="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => setOne(p, "checked_in")}
                            >
                              <Check className="h-3 w-3" strokeWidth={2.5} />
                              In
                            </Button>
                          )}
                          {p.attendance !== "absent" && (
                            <Button
                              size="sm"
                              tone="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => setOne(p, "absent")}
                            >
                              <UserX className="h-3 w-3" strokeWidth={2.5} />
                              Absent
                            </Button>
                          )}
                          {p.attendance !== "pending" && (
                            <Button
                              size="sm"
                              tone="ghost"
                              className="h-7 px-2 text-xs text-muted-foreground"
                              onClick={() => setOne(p, "pending")}
                            >
                              <Square className="h-3 w-3" strokeWidth={2.5} />
                              Reset
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
