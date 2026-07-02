import type {
  BulkScheduleRequest,
  BulkScheduleResponse,
  MatchView,
  ScheduleAssignRequest,
  ScheduleCheckRequest,
  ScheduleCheckResponse,
  ScheduleQueueView,
  ScheduleResultView,
} from "@tournament/api-client";

import { api, apiGet } from "@/lib/api";

/** Typed transport for match scheduling — assign/move/unschedule a match's court +
 * time, dry-run conflict checks, bulk scheduling, and the organizer's live queue. */

export async function checkSchedule(
  matchId: string,
  body: ScheduleCheckRequest,
): Promise<ScheduleCheckResponse> {
  const { data } = await api.post<ScheduleCheckResponse>(
    `/matches/${matchId}/schedule/check`,
    body,
  );
  return data;
}

export async function assignSchedule(
  matchId: string,
  body: ScheduleAssignRequest,
): Promise<ScheduleResultView> {
  const { data } = await api.patch<ScheduleResultView>(`/matches/${matchId}/schedule`, body);
  return data;
}

export async function clearSchedule(matchId: string): Promise<MatchView> {
  const { data } = await api.delete<MatchView>(`/matches/${matchId}/schedule`);
  return data;
}

export async function bulkAssignSchedule(
  tournamentId: string,
  body: BulkScheduleRequest,
): Promise<BulkScheduleResponse> {
  const { data } = await api.post<BulkScheduleResponse>(
    `/tournaments/${tournamentId}/schedule/bulk`,
    body,
  );
  return data;
}

export function getQueue(tournamentId: string): Promise<ScheduleQueueView> {
  return apiGet<ScheduleQueueView>(`/tournaments/${tournamentId}/schedule/queue`);
}
