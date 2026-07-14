"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  PublishRequest,
  StatusTransitionRequest,
  TournamentResponse,
  UpdateTournamentRequest,
} from "@tournament/api-client";

import * as tournamentsApi from "@/features/tournaments/tournaments-api";
import type { TournamentDraft } from "@/features/tournaments/use-tournament-draft";
import { queryKeys } from "@/lib/query-keys";

/** A bare date string (YYYY-MM-DD) → ISO datetime at UTC midnight, or null when empty. */
function toIso(date: string): string | null {
  return date ? new Date(`${date}T00:00:00Z`).toISOString() : null;
}

// ---- queries ----

export function useTournaments() {
  return useQuery({
    queryKey: queryKeys.tournaments.list(),
    queryFn: tournamentsApi.listTournaments,
  });
}

export function useTournament(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.tournaments.detail(id),
    queryFn: () => tournamentsApi.getTournament(id),
    enabled: options?.enabled ?? true,
  });
}

export function useDivisions(tournamentId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.tournaments.divisions(tournamentId),
    queryFn: () => tournamentsApi.listDivisions(tournamentId),
    enabled: options?.enabled ?? true,
  });
}

export function useStages(divisionId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.divisions.stages(divisionId),
    queryFn: () => tournamentsApi.listStages(divisionId),
    enabled: options?.enabled ?? true,
  });
}

// ---- mutations ----

export function useCreateTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tournamentsApi.createTournament,
    onSuccess: (created) => {
      queryClient.setQueryData(queryKeys.tournaments.detail(created.id), created);
      void queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.list() });
    },
  });
}

/**
 * Full create flow: tournament → (optional dates) → each division + its stage. Sequential
 * because divisions/stages reference the created ids. Returns the new tournament.
 */
export function useCreateTournamentFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: TournamentDraft) => {
      const tournament = await tournamentsApi.createTournament({
        name: draft.name,
        slug: draft.slug,
        sportKey: draft.sportKey,
        visibility: draft.visibility,
      });
      if (draft.startsAt || draft.endsAt) {
        await tournamentsApi.updateTournament(tournament.id, {
          startsAt: toIso(draft.startsAt),
          endsAt: toIso(draft.endsAt),
        });
      }
      for (const division of draft.divisions) {
        const created = await tournamentsApi.createDivision(tournament.id, {
          name: division.name,
          participantType: division.participantType,
        });
        await tournamentsApi.createStage(created.id, { type: draft.format, seq: 0 });
      }
      return tournament;
    },
    onSuccess: (tournament) => {
      queryClient.setQueryData(queryKeys.tournaments.detail(tournament.id), tournament);
      void queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.list() });
    },
  });
}

export function useUpdateTournament(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateTournamentRequest) => tournamentsApi.updateTournament(id, body),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.tournaments.detail(id), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.list() });
    },
  });
}

/** Status transition with optimistic swap + rollback (snappy lifecycle buttons). */
export function useTransitionStatus(id: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.tournaments.detail(id);
  return useMutation({
    mutationFn: (body: StatusTransitionRequest) => tournamentsApi.transitionStatus(id, body),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TournamentResponse>(key);
      if (previous) {
        queryClient.setQueryData<TournamentResponse>(key, { ...previous, status: body.status });
      }
      return { previous };
    },
    onError: (_err, _body, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.list() });
    },
  });
}

export function usePublishTournament(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: PublishRequest) => tournamentsApi.publishTournament(id, body),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.tournaments.detail(id), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.list() });
    },
  });
}

export function useCreateDivision(tournamentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tournamentsApi.createDivision.bind(null, tournamentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tournaments.divisions(tournamentId),
      });
    },
  });
}

export function useUpdateDivision(tournamentId: string, divisionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: tournamentsApi.UpdateDivisionBody) =>
      tournamentsApi.updateDivision(divisionId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tournaments.divisions(tournamentId),
      });
    },
  });
}

export function useCreateStage(divisionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tournamentsApi.createStage.bind(null, divisionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.divisions.stages(divisionId) });
    },
  });
}

export function useUpdateStageConfig(stageId: string, divisionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: Record<string, unknown>) =>
      tournamentsApi.updateStageConfig(divisionId, stageId, config),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.divisions.stages(divisionId) });
    },
  });
}

export function useGenerateDraw(stageId: string, divisionId: string, tournamentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tournamentsApi.generateDraw.bind(null, stageId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.divisions.stages(divisionId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.stages.matches(stageId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.matches(tournamentId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.schedule.queue(tournamentId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.readiness.tournament(tournamentId),
      });
    },
  });
}

/** Wipes a stage's draw so it can be regenerated. Backend rejects (409) once any match has
 * a real submitted result — see `StageResponse.locked`, which mirrors that same guard. */
export function useClearDraw(stageId: string, divisionId: string, tournamentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => tournamentsApi.clearDraw(stageId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.divisions.stages(divisionId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.stages.matches(stageId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.stages.standings(stageId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.matches(tournamentId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.schedule.queue(tournamentId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.readiness.tournament(tournamentId),
      });
    },
  });
}

export function useAdvanceToKnockout(stageId: string, divisionId: string, tournamentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (take: number) => tournamentsApi.advanceToKnockout(stageId, { take }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.divisions.stages(divisionId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.stages.matches(stageId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.matches(tournamentId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.schedule.queue(tournamentId) });
    },
  });
}

export function useDeleteTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tournamentsApi.deleteTournament,
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.tournaments.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.list() });
    },
  });
}
