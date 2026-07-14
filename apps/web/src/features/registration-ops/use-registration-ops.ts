"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BulkCheckInRequest,
  CheckInRequest,
  ImportRequest,
  SaveMappingTemplateRequest,
} from "@tournament/api-client";

import * as opsApi from "@/features/registration-ops/registration-ops-api";
import { queryKeys } from "@/lib/query-keys";

// ---- import sources ----

export function useImportSources() {
  return useQuery({
    queryKey: queryKeys.imports.sources(),
    queryFn: opsApi.listImportSources,
    staleTime: Infinity,
  });
}

// ---- mapping templates ----

export function useMappingTemplates(source?: string) {
  return useQuery({
    queryKey: queryKeys.imports.templates(source),
    queryFn: () => opsApi.listMappingTemplates(source),
  });
}

export function useSaveMappingTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveMappingTemplateRequest) => opsApi.saveMappingTemplate(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.imports.templates() });
    },
  });
}

export function useDeleteMappingTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) => opsApi.deleteMappingTemplate(templateId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.imports.templates() });
    },
  });
}

// ---- preview + commit ----

export function useCommitImport(divisionId: string, tournamentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ImportRequest) => opsApi.commitImport(divisionId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.divisions.registrations(divisionId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.divisions.participants(divisionId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tournaments.participants(tournamentId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.readiness.tournament(tournamentId),
      });
    },
  });
}

// ---- attendance ----

export function useAttendance(divisionId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.attendance.division(divisionId),
    queryFn: () => opsApi.listAttendance(divisionId),
    enabled: options?.enabled ?? true,
  });
}

export function useSetAttendance(divisionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { participantId: string; body: CheckInRequest }) =>
      opsApi.setAttendance(vars.participantId, vars.body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.division(divisionId) });
    },
  });
}

export function useBulkSetAttendance(divisionId: string, tournamentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: BulkCheckInRequest) => opsApi.bulkSetAttendance(divisionId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.division(divisionId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.readiness.tournament(tournamentId),
      });
    },
  });
}

// ---- readiness ----

export function useTournamentReadiness(tournamentId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.readiness.tournament(tournamentId),
    queryFn: () => opsApi.getTournamentReadiness(tournamentId),
    enabled: options?.enabled ?? true,
    refetchInterval: 60_000,
  });
}
