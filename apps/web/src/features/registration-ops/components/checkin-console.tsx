"use client";

import type { ParticipantAttendanceView } from "@tournament/api-client";
import { ArrowLeft, Check, CheckSquare, Clock, Search, Square, UserX } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { TableSkeleton } from "@/components/common/loading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import {
  useAttendance,
  useBulkSetAttendance,
  useSetAttendance,
} from "@/features/registration-ops/use-registration-ops";
import { CheckInLinkPanel } from "@/features/registration-ops/components/checkin-link-panel";
import { playersForCheckIn } from "@/features/registrations/franchise-roster";
import { useDivisions } from "@/features/tournaments/use-tournaments";
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";
import { errorMessage } from "@/lib/problem";
import { cn } from "@/lib/utils";

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
  const [search, setSearch] = useState("");

  const participants = useMemo(() => playersForCheckIn(attendance.data ?? []), [attendance.data]);

  const filtered = useMemo(() => {
    if (!search.trim()) return participants;
    const q = search.toLowerCase();
    return participants.filter((p) => p.displayName.toLowerCase().includes(q));
  }, [participants, search]);

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
      prev.size === filtered.length ? new Set() : new Set(filtered.map((p) => p.id)),
    );

  const setOne = useCallback(
    (p: ParticipantAttendanceView, status: AttendanceStatus) => {
      setPendingIds((prev) => new Set([...prev, p.id]));
      setAttendanceMut.mutate(
        { participantId: p.id, body: { status } },
        {
          onSuccess: () => toast.success(`${p.displayName} marked ${STATUS_META[status].label}`),
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
        description="Mark participants as checked in, absent, or pending."
      />

      {canManage ? <CheckInLinkPanel divisionId={divisionId} /> : null}

      {/* Sticky header: counts + search + bulk bar */}
      <div className="bg-background sticky top-0 z-10 -mx-4 flex flex-col gap-3 px-4 pb-3 pt-1 md:static md:z-auto md:mx-0 md:bg-transparent md:px-0">
        {/* Count chips */}
        <div className="grid grid-cols-3 gap-2">
          {(["checked_in", "pending", "absent"] as const).map((s) => (
            <div
              key={s}
              className={cn(
                "border-border rounded-2xl border p-3 text-center",
                s === "checked_in" && counts[s] > 0 && "border-mint bg-mint-tint/40",
                s === "absent" && counts[s] > 0 && "border-pink bg-pink-tint/40",
              )}
            >
              <p className="text-xl font-bold tabular-nums md:text-2xl">{counts[s]}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">{STATUS_META[s].label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search participants…"
            className="pl-9"
          />
        </div>

        {/* Bulk action bar */}
        {canManage && selected.size > 0 && (
          <div className="border-candy bg-candy-tint flex flex-wrap items-center gap-2 rounded-2xl border-2 px-4 py-2.5">
            <span className="mr-2 text-sm font-medium">{selected.size} selected</span>
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
              className="text-muted-foreground ml-auto"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
        )}
      </div>

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
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matches"
          description={`No participants matching "${search}".`}
          action={
            <Button tone="paper" size="sm" onClick={() => setSearch("")}>
              Clear search
            </Button>
          }
        />
      ) : (
        <ul className="border-border divide-border divide-y overflow-hidden rounded-2xl border">
          {canManage && (
            <li className="bg-muted/30 flex items-center gap-3 px-4 py-2">
              <Checkbox
                checked={selected.size === filtered.length && filtered.length > 0}
                onCheckedChange={toggleAll}
                aria-label="Select all"
              />
              <span className="text-muted-foreground text-xs font-medium">
                {filtered.length} participant{filtered.length !== 1 ? "s" : ""}
                {search ? " matching search" : ""}
              </span>
            </li>
          )}
          {filtered.map((p) => (
            <li
              key={p.id}
              tabIndex={canManage ? 0 : undefined}
              onKeyDown={(e) => handleKeyDown(e, p)}
              className={cn(
                "bg-card flex min-h-[64px] items-center gap-3 px-4 py-3",
                canManage && "focus:bg-muted/30 focus:outline-none",
              )}
            >
              {canManage && (
                <Checkbox
                  checked={selected.has(p.id)}
                  onCheckedChange={() => toggleSelect(p.id)}
                  aria-label={`Select ${p.displayName}`}
                />
              )}

              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium leading-snug">{p.displayName}</span>
                <span className="text-muted-foreground text-xs capitalize">{p.kind}</span>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <AttendanceBadge status={p.attendance} />

                {canManage && (
                  <>
                    {pendingIds.has(p.id) ? (
                      <Spinner className="h-5 w-5" />
                    ) : (
                      <div className="flex items-center gap-1">
                        {p.attendance !== "checked_in" && (
                          <Button
                            size="sm"
                            tone="ghost"
                            className="h-10 w-10 p-0"
                            onClick={() => setOne(p, "checked_in")}
                            aria-label={`Check in ${p.displayName}`}
                          >
                            <Check className="h-4 w-4" strokeWidth={2.5} />
                          </Button>
                        )}
                        {p.attendance !== "absent" && (
                          <Button
                            size="sm"
                            tone="ghost"
                            className="h-10 w-10 p-0"
                            onClick={() => setOne(p, "absent")}
                            aria-label={`Mark ${p.displayName} absent`}
                          >
                            <UserX className="h-4 w-4" strokeWidth={2.5} />
                          </Button>
                        )}
                        {p.attendance !== "pending" && (
                          <Button
                            size="sm"
                            tone="ghost"
                            className="text-muted-foreground h-10 w-10 p-0"
                            onClick={() => setOne(p, "pending")}
                            aria-label={`Reset ${p.displayName} to pending`}
                          >
                            <Square className="h-4 w-4" strokeWidth={2.5} />
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-muted-foreground hidden text-xs md:block">
        Keyboard shortcuts (desktop): C = checked in · A = absent · P = pending
      </p>
    </div>
  );
}
