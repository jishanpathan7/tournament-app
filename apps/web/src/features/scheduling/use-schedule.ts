"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BulkScheduleRequest, MatchView, ScheduleAssignRequest } from "@tournament/api-client";

import * as schedulingApi from "@/features/scheduling/scheduling-api";
import { queryKeys } from "@/lib/query-keys";

export function useScheduleQueue(
  tournamentId: string,
  options?: { enabled?: boolean; refetchInterval?: number | false },
) {
  return useQuery({
    queryKey: queryKeys.schedule.queue(tournamentId),
    queryFn: () => schedulingApi.getQueue(tournamentId),
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
  });
}

export function useCheckSchedule() {
  return useMutation({
    mutationFn: (vars: { matchId: string; body: ScheduleAssignRequest }) =>
      schedulingApi.checkSchedule(vars.matchId, vars.body),
  });
}

interface MatchesContext {
  previous?: MatchView[];
}

/** Assigns or moves a match's court/time. Optimistically updates the tournament's
 * cached match list (what both the timeline and Match Center read) so a drag-and-drop
 * move feels instant; rolled back on failure (a hard conflict, permission, etc). */
export function useAssignSchedule(tournamentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { matchId: string; body: ScheduleAssignRequest }) =>
      schedulingApi.assignSchedule(vars.matchId, vars.body),
    onMutate: async (vars): Promise<MatchesContext> => {
      const key = queryKeys.tournaments.matches(tournamentId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MatchView[]>(key);
      queryClient.setQueryData<MatchView[]>(key, (old) =>
        (old ?? []).map((m) =>
          m.id === vars.matchId
            ? {
                ...m,
                courtId: vars.body.courtId,
                scheduledAt: vars.body.scheduledAt,
              }
            : m,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.tournaments.matches(tournamentId), context.previous);
      }
    },
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.matches.detail(result.match.id), result.match);
      void queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.matches(tournamentId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.schedule.queue(tournamentId) });
    },
  });
}

export function useClearSchedule(tournamentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (matchId: string) => schedulingApi.clearSchedule(matchId),
    onMutate: async (matchId): Promise<MatchesContext> => {
      const key = queryKeys.tournaments.matches(tournamentId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MatchView[]>(key);
      queryClient.setQueryData<MatchView[]>(key, (old) =>
        (old ?? []).map((m) =>
          m.id === matchId ? { ...m, courtId: null, scheduledAt: null } : m,
        ),
      );
      return { previous };
    },
    onError: (_err, _matchId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.tournaments.matches(tournamentId), context.previous);
      }
    },
    onSuccess: (match) => {
      queryClient.setQueryData(queryKeys.matches.detail(match.id), match);
      void queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.matches(tournamentId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.schedule.queue(tournamentId) });
    },
  });
}

export function useBulkAssignSchedule(tournamentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: BulkScheduleRequest) => schedulingApi.bulkAssignSchedule(tournamentId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.matches(tournamentId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.schedule.queue(tournamentId) });
    },
  });
}
