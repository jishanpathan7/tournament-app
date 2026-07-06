"use client";

import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import type { StageResponse, TournamentStatus } from "@tournament/api-client";

import * as registrationsApi from "@/features/registrations/registrations-api";
import {
  useTournamentActivity,
  useTournamentMatches,
  useTournamentParticipants,
  useTournamentStages,
} from "@/features/matches/use-tournament-matches";
import { useTournamentReadiness } from "@/features/registration-ops/use-registration-ops";
import * as scoringApi from "@/features/scoring/scoring-api";
import { useScheduleQueue } from "@/features/scheduling/use-schedule";
import {
  deriveAlerts,
  deriveBeforeStats,
  deriveAfterStats,
  deriveChampions,
  deriveDrawProgress,
  deriveDuringStats,
  deriveRegistrationTotals,
  deriveStepSignals,
  deriveTournamentStep,
  getDashboardPhase,
  type DashboardPhase,
  type TournamentStep,
} from "@/features/tournaments/dashboard/config";
import { useDivisions, useTournament } from "@/features/tournaments/use-tournaments";
import { queryKeys } from "@/lib/query-keys";

/** Parallel data wiring for the tournament dashboard — reuses existing hooks/APIs. */
export function useTournamentDashboard(tournamentId: string) {
  const tournament = useTournament(tournamentId);
  const phase: DashboardPhase = getDashboardPhase(
    (tournament.data?.status ?? "draft") as TournamentStatus,
  );

  const divisions = useDivisions(tournamentId);
  const divisionIds = useMemo(
    () => (divisions.data ?? []).map((d) => d.id),
    [divisions.data],
  );

  const readiness = useTournamentReadiness(tournamentId, { enabled: phase !== "after" });
  const matches = useTournamentMatches(tournamentId);
  const queue = useScheduleQueue(tournamentId, { enabled: phase === "during" });
  const stages = useTournamentStages(tournamentId);
  const participants = useTournamentParticipants(tournamentId);
  const activity = useTournamentActivity(tournamentId);

  const registrationQueries = useQueries({
    queries: divisionIds.map((divisionId) => ({
      queryKey: queryKeys.divisions.registrations(divisionId),
      queryFn: () => registrationsApi.listRegistrations(divisionId),
      enabled: phase === "before" && divisionIds.length > 0,
    })),
  });

  const participantQueries = useQueries({
    queries: divisionIds.map((divisionId) => ({
      queryKey: queryKeys.divisions.participants(divisionId),
      queryFn: () => registrationsApi.listParticipants(divisionId),
      enabled: phase === "before" && divisionIds.length > 0,
    })),
  });

  const stageIds = useMemo(() => (stages.data ?? []).map((s) => s.id), [stages.data]);

  const standingsQueries = useQueries({
    queries: stageIds.map((stageId) => ({
      queryKey: queryKeys.stages.standings(stageId),
      queryFn: () => scoringApi.getStandings(stageId),
      enabled: (phase === "during" || phase === "after") && stageIds.length > 0,
    })),
  });

  const registrationsByDivision = useMemo(() => {
    const map = new Map<string, Awaited<ReturnType<typeof registrationsApi.listRegistrations>>>();
    divisionIds.forEach((id, i) => {
      const data = registrationQueries[i]?.data;
      if (data) map.set(id, data);
    });
    return map;
  }, [divisionIds, registrationQueries]);

  const participantsByDivision = useMemo(() => {
    const map = new Map<string, Awaited<ReturnType<typeof registrationsApi.listParticipants>>>();
    divisionIds.forEach((id, i) => {
      const data = participantQueries[i]?.data;
      if (data) map.set(id, data);
    });
    return map;
  }, [divisionIds, participantQueries]);

  const registrationTotals = useMemo(
    () => deriveRegistrationTotals(registrationsByDivision, participantsByDivision),
    [registrationsByDivision, participantsByDivision],
  );

  const drawProgress = useMemo(
    () => deriveDrawProgress(stages.data ?? []),
    [stages.data],
  );

  const participantsById = useMemo(
    () => new Map((participants.data ?? []).map((p) => [p.id, p])),
    [participants.data],
  );

  const stagesByDivision = useMemo(() => {
    const map = new Map<string, StageResponse[]>();
    for (const stage of stages.data ?? []) {
      const list = map.get(stage.divisionId) ?? [];
      list.push(stage);
      map.set(stage.divisionId, list);
    }
    return map;
  }, [stages.data]);

  const standingsByStage = useMemo(() => {
    const map = new Map<string, Awaited<ReturnType<typeof scoringApi.getStandings>>>();
    stageIds.forEach((id, i) => {
      const data = standingsQueries[i]?.data;
      if (data) map.set(id, data);
    });
    return map;
  }, [stageIds, standingsQueries]);

  const champions = useMemo(() => {
    if (!divisions.data) return [];
    return deriveChampions(divisions.data, stagesByDivision, standingsByStage, participantsById);
  }, [divisions.data, stagesByDivision, standingsByStage, participantsById]);

  const alerts = useMemo(() => {
    if (!tournament.data) return [];
    return deriveAlerts({
      tournament: tournament.data,
      readiness: readiness.data,
      queue: queue.data,
      matches: matches.data ?? [],
      registrationTotals,
      drawProgress,
    });
  }, [tournament.data, readiness.data, queue.data, matches.data, registrationTotals, drawProgress]);

  const stats = useMemo(() => {
    if (!tournament.data) return [];
    switch (phase) {
      case "before":
        return deriveBeforeStats(readiness.data, registrationTotals, drawProgress);
      case "during":
        return deriveDuringStats(matches.data ?? [], queue.data);
      case "after":
        return deriveAfterStats(matches.data ?? [], divisions.data ?? [], tournament.data);
    }
  }, [
    phase,
    tournament.data,
    readiness.data,
    registrationTotals,
    drawProgress,
    matches.data,
    queue.data,
    divisions.data,
  ]);

  const stepSignals = useMemo(
    () => deriveStepSignals(readiness.data, registrationTotals, drawProgress, queue.data),
    [readiness.data, registrationTotals, drawProgress, queue.data],
  );

  const step: TournamentStep = useMemo(
    () =>
      deriveTournamentStep(
        (tournament.data?.status ?? "draft") as TournamentStatus,
        stepSignals,
      ),
    [tournament.data?.status, stepSignals],
  );

  const isLoadingCore =
    tournament.isLoading ||
    divisions.isLoading ||
    matches.isLoading ||
    (phase !== "after" && readiness.isLoading);

  return {
    tournament,
    phase,
    step,
    stepSignals,
    divisions,
    readiness,
    matches,
    queue,
    stages,
    participants,
    activity,
    registrationTotals,
    drawProgress,
    champions,
    alerts,
    stats,
    participantsById,
    stagesByDivision,
    standingsByStage,
    isLoadingCore,
  };
}
