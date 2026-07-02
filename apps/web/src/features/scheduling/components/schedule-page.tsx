"use client";

import { Tv } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QueuePanel } from "@/features/scheduling/components/queue-panel";
import { ScheduleTimeline } from "@/features/scheduling/components/schedule-timeline";

/** Console entry point for scheduling: the drag-and-drop timeline and the live queue,
 * plus a link to the chrome-free, TV-friendly court dashboard (opens in a new tab so
 * the console session stays put). */
export function SchedulePage({ tournamentId }: { tournamentId: string }) {
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
