"use client";

import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { ConflictView, MatchView } from "@tournament/api-client";
import { CalendarClock, ListPlus } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingPanel } from "@/components/common/loading";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { BulkScheduleDialog } from "@/features/scheduling/components/bulk-schedule-dialog";
import { ScheduleLane } from "@/features/scheduling/components/schedule-lane";
import { ScheduleMatchCard } from "@/features/scheduling/components/schedule-match-card";
import {
  DEFAULT_DURATION_MINUTES,
  bucketMatches,
  suggestNextSlot,
} from "@/features/scheduling/config";
import { useAssignSchedule, useClearSchedule } from "@/features/scheduling/use-schedule";
import { useTournamentCourts } from "@/features/courts/use-courts";
import {
  useTournamentMatches,
  useTournamentParticipants,
} from "@/features/matches/use-tournament-matches";
import { useTournament } from "@/features/tournaments/use-tournaments";
import { useCan } from "@/hooks/use-permissions";
import { ACTIONS } from "@/lib/permissions";
import { errorMessage } from "@/lib/problem";

const UNSCHEDULED_LANE = "unscheduled";

export function ScheduleTimeline({ tournamentId }: { tournamentId: string }) {
  const can = useCan();
  const canManage = can(ACTIONS.SCHEDULE_MANAGE);

  const tournament = useTournament(tournamentId);
  const matches = useTournamentMatches(tournamentId);
  const participants = useTournamentParticipants(tournamentId);
  const courts = useTournamentCourts(tournamentId);

  const assignSchedule = useAssignSchedule(tournamentId);
  const clearSchedule = useClearSchedule(tournamentId);

  const [activeMatch, setActiveMatch] = useState<MatchView | null>(null);
  const [conflictsByMatch, setConflictsByMatch] = useState<Map<string, ConflictView[]>>(new Map());
  const [bulkOpen, setBulkOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const participantsById = useMemo(
    () => new Map((participants.data ?? []).map((p) => [p.id, p])),
    [participants.data],
  );
  const buckets = useMemo(() => bucketMatches(matches.data ?? []), [matches.data]);
  const activeCourts = useMemo(
    () => (courts.data ?? []).map((a) => a.court).filter((c) => c.status === "active"),
    [courts.data],
  );

  if (matches.isLoading || courts.isLoading || tournament.isLoading) {
    return <LoadingPanel label="Loading schedule" />;
  }
  if (matches.isError)
    return <ErrorState error={matches.error} onRetry={() => matches.refetch()} />;
  if (courts.isError) return <ErrorState error={courts.error} onRetry={() => courts.refetch()} />;

  function handleDragStart(event: DragStartEvent) {
    setActiveMatch((event.active.data.current?.match as MatchView | undefined) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveMatch(null);
    const { active, over } = event;
    if (!over) return;
    const matchId = String(active.id);
    const targetLane = String(over.id);
    const match = (matches.data ?? []).find((m) => m.id === matchId);
    if (!match) return;

    if (targetLane === UNSCHEDULED_LANE) {
      if (!match.courtId) return; // already unscheduled, no-op
      clearSchedule.mutate(matchId, {
        onSuccess: () => toast.success("Match unscheduled"),
        onError: (e) => toast.error(errorMessage(e, "Couldn't unschedule match")),
      });
      return;
    }
    if (targetLane === match.courtId) return; // dropped back on the same lane

    const courtMatches = (buckets.byCourt.get(targetLane) ?? []).filter((m) => m.id !== matchId);
    const nextSlot = suggestNextSlot(
      courtMatches,
      DEFAULT_DURATION_MINUTES,
      tournament.data?.startsAt ?? null,
    );
    assignSchedule.mutate(
      {
        matchId,
        body: {
          courtId: targetLane,
          scheduledAt: nextSlot.toISOString(),
          durationMinutes: DEFAULT_DURATION_MINUTES,
        },
      },
      {
        onSuccess: (result) => {
          setConflictsByMatch((prev) => new Map(prev).set(matchId, result.conflicts));
          if (result.conflicts.length > 0) {
            toast.warning(`Scheduled, but ${result.conflicts.length} conflict(s) to review`);
          } else {
            toast.success("Match scheduled");
          }
        },
        onError: (e) => toast.error(errorMessage(e, "Couldn't schedule match")),
      },
    );
  }

  function handleRetime(matchId: string, scheduledAt: string) {
    const match = (matches.data ?? []).find((m) => m.id === matchId);
    if (!match?.courtId) return;
    assignSchedule.mutate(
      {
        matchId,
        body: { courtId: match.courtId, scheduledAt, durationMinutes: DEFAULT_DURATION_MINUTES },
      },
      {
        onSuccess: (result) => {
          setConflictsByMatch((prev) => new Map(prev).set(matchId, result.conflicts));
          toast.success("Time updated");
        },
        onError: (e) => toast.error(errorMessage(e, "Couldn't update time")),
      },
    );
  }

  function handleClear(matchId: string) {
    clearSchedule.mutate(matchId, {
      onSuccess: () => toast.success("Match unscheduled"),
      onError: (e) => toast.error(errorMessage(e, "Couldn't unschedule match")),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-sm">
          Drag a match onto a court to schedule it, or back to Unscheduled to clear it. Click a time
          to fine-tune it.
        </p>
        {canManage ? (
          <Button tone="paper" size="sm" onClick={() => setBulkOpen(true)}>
            <ListPlus className="h-4 w-4" strokeWidth={2.25} />
            Bulk schedule
          </Button>
        ) : null}
      </div>

      {buckets.pending.length > 0 ? (
        <p className="border-yellow bg-yellow-tint text-ink rounded-2xl border-2 px-4 py-2 text-sm">
          {buckets.pending.length} match{buckets.pending.length === 1 ? "" : "es"} still waiting on
          earlier bracket results — not schedulable yet.
        </p>
      ) : null}

      {(courts.data ?? []).length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          eyebrow="No courts assigned"
          title="Assign a court before scheduling"
          description="Head to Courts to assign at least one court to this tournament, then come back here to schedule matches."
        />
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-2">
            <ScheduleLane
              id={UNSCHEDULED_LANE}
              title="Unscheduled"
              subtitle={`${buckets.unscheduled.length} ready`}
              matches={buckets.unscheduled}
              participantsById={participantsById}
              conflictsByMatch={conflictsByMatch}
              canManage={canManage}
              emptyLabel="Nothing waiting — every ready match has a court and time."
            />
            {(courts.data ?? []).map((assignment) => (
              <ScheduleLane
                key={assignment.court.id}
                id={assignment.court.id}
                title={assignment.court.name}
                subtitle={assignment.court.venueName}
                courtStatus={assignment.court.status}
                matches={buckets.byCourt.get(assignment.court.id) ?? []}
                participantsById={participantsById}
                conflictsByMatch={conflictsByMatch}
                canManage={canManage}
                onClear={handleClear}
                onRetime={handleRetime}
                emptyLabel="Drop a match here to schedule it on this court."
              />
            ))}
          </div>
          <DragOverlay>
            {activeMatch ? (
              <ScheduleMatchCard
                match={activeMatch}
                participantsById={participantsById}
                conflicts={conflictsByMatch.get(activeMatch.id) ?? []}
                canManage={canManage}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <BulkScheduleDialog
        tournamentId={tournamentId}
        unscheduled={buckets.unscheduled}
        activeCourts={activeCourts}
        defaultStart={tournament.data?.startsAt ? new Date(tournament.data.startsAt) : new Date()}
        open={bulkOpen}
        onOpenChange={setBulkOpen}
      />
    </div>
  );
}
