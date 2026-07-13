"use client";

import { Tv } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import { DEFAULT_DURATION_MINUTES, effectiveDurationMinutes } from "@/features/scheduling/config";
import { QueuePanel } from "@/features/scheduling/components/queue-panel";
import { ScheduleTimeline } from "@/features/scheduling/components/schedule-timeline";
import { useUpdateTournament, useTournament } from "@/features/tournaments/use-tournaments";
import { errorMessage } from "@/lib/problem";

/** Console entry point for scheduling: the drag-and-drop timeline and the live queue,
 * plus a link to the chrome-free, TV-friendly court dashboard (opens in a new tab so
 * the console session stays put). */
export function SchedulePage({ tournamentId }: { tournamentId: string }) {
  const tournament = useTournament(tournamentId);
  const update = useUpdateTournament(tournamentId);
  const currentDuration = effectiveDurationMinutes(
    tournament.data?.settings as Record<string, unknown> | undefined,
  );

  function handleDurationChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = Number(e.target.value);
    if (!val || val < 5 || val > 240) return;
    update.mutate(
      { matchDurationMinutes: val },
      { onError: (err) => toast.error(errorMessage(err, "Couldn't update duration")) },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Operations"
        title="Schedule"
        description="Assign courts and times, watch for conflicts, and track what's happening right now."
        actions={
          <Button asChild tone="paper" size="sm">
            <Link href={`/console/tournaments/${tournamentId}/schedule/dashboard`} target="_blank">
              <Tv className="h-4 w-4" strokeWidth={2.25} />
              Open TV dashboard
            </Link>
          </Button>
        }
      />

      <div className="flex items-center gap-3 self-start rounded-2xl border px-4 py-2.5">
        <Label htmlFor="match-duration" className="whitespace-nowrap text-sm font-medium">
          Match duration
        </Label>
        <input
          id="match-duration"
          type="number"
          min={5}
          max={240}
          step={5}
          defaultValue={currentDuration}
          onBlur={handleDurationChange}
          className="focus:ring-candy w-16 rounded-lg border px-2 py-1 text-sm tabular-nums focus:outline-none focus:ring-2"
        />
        <span className="text-muted-foreground text-sm">min</span>
        {currentDuration !== DEFAULT_DURATION_MINUTES && (
          <span className="text-muted-foreground text-xs">
            (default: {DEFAULT_DURATION_MINUTES} min)
          </span>
        )}
      </div>

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="queue">Queue</TabsTrigger>
        </TabsList>
        <TabsContent value="timeline" className="mt-4">
          <ScheduleTimeline tournamentId={tournamentId} />
        </TabsContent>
        <TabsContent value="queue" className="mt-4">
          <QueuePanel tournamentId={tournamentId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
