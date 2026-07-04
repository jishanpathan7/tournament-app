"use client";

import { ActivityTimeline } from "@/features/matches/components/activity-timeline";

export function ActivityFeedPanel({ tournamentId }: { tournamentId: string }) {
  return <ActivityTimeline tournamentId={tournamentId} />;
}
