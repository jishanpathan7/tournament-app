"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BulkApproveResult,
  ParticipantUpdate,
  RegistrationResponse,
  SubmitRegistrationRequest,
} from "@tournament/api-client";

import * as registrationsApi from "@/features/registrations/registrations-api";
import { queryKeys } from "@/lib/query-keys";

export function useRegistrations(divisionId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.divisions.registrations(divisionId),
    queryFn: () => registrationsApi.listRegistrations(divisionId),
    enabled: options?.enabled ?? true,
  });
}

export function useParticipants(divisionId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.divisions.participants(divisionId),
    queryFn: () => registrationsApi.listParticipants(divisionId),
    enabled: options?.enabled ?? true,
  });
}

export function useTeam(teamId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.teams.detail(teamId ?? ""),
    queryFn: () => registrationsApi.getTeam(teamId!),
    enabled: !!teamId,
  });
}

export function useSubmitRegistration(divisionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmitRegistrationRequest) =>
      registrationsApi.submitRegistration(divisionId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.divisions.registrations(divisionId),
      });
    },
  });
}

/** Optimistically flip one registration's status in the cached list, roll back on error. */
function useRegistrationDecision(
  divisionId: string,
  mutationFn: (registrationId: string) => Promise<unknown>,
  optimisticStatus: string,
) {
  const queryClient = useQueryClient();
  const key = queryKeys.divisions.registrations(divisionId);
  return useMutation({
    mutationFn,
    onMutate: async (registrationId: string) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<RegistrationResponse[]>(key);
      if (previous) {
        queryClient.setQueryData<RegistrationResponse[]>(
          key,
          previous.map((r) => (r.id === registrationId ? { ...r, status: optimisticStatus } : r)),
        );
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.divisions.participants(divisionId),
      });
    },
  });
}

export function useApproveRegistration(divisionId: string) {
  return useRegistrationDecision(divisionId, registrationsApi.approveRegistration, "approved");
}

export function useRejectRegistration(divisionId: string) {
  return useRegistrationDecision(divisionId, registrationsApi.rejectRegistration, "rejected");
}

export function useWaitlistRegistration(divisionId: string) {
  return useRegistrationDecision(divisionId, registrationsApi.waitlistRegistration, "waitlisted");
}

export function useWithdrawRegistration(divisionId: string) {
  return useRegistrationDecision(divisionId, registrationsApi.withdrawRegistration, "withdrawn");
}

export function useUpdateParticipant(divisionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ participantId, data }: { participantId: string; data: ParticipantUpdate }) =>
      registrationsApi.updateParticipant(participantId, data),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.divisions.participants(divisionId),
      });
      void queryClient.invalidateQueries({ queryKey: ["squads"] });
      void queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      // Pairing board shows pair names — must refresh when an individual name/skill changes.
      void queryClient.invalidateQueries({ queryKey: queryKeys.divisions.pairing(divisionId) });
      // Partner-preference warnings depend on player preferences — refresh on any edit.
      void queryClient.invalidateQueries({
        queryKey: ["divisions", divisionId, "partner-warnings"],
      });
    },
  });
}

export function useRemoveParticipant(divisionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (participantId: string) => registrationsApi.removeParticipant(participantId),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.divisions.participants(divisionId),
      });
      void queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      void queryClient.invalidateQueries({ queryKey: ["squads"] });
      // Pairing board must reflect the removed player immediately.
      void queryClient.invalidateQueries({ queryKey: queryKeys.divisions.pairing(divisionId) });
    },
  });
}

export interface BulkActionResult {
  succeeded: string[];
  failed: { id: string; error: unknown }[];
}

/** Create Participant rows for any approved registrations that are missing them. */
export function useBackfillParticipants(divisionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => registrationsApi.backfillParticipants(divisionId),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.divisions.participants(divisionId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.divisions.registrations(divisionId),
      });
    },
  });
}

/** Single-request bulk approve via the backend's approve-all endpoint. */
export function useBulkApproveRegistrations(divisionId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.divisions.registrations(divisionId);
  return useMutation({
    mutationFn: (): Promise<BulkApproveResult> =>
      registrationsApi.bulkApproveRegistrations(divisionId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.divisions.participants(divisionId),
      });
    },
  });
}

/**
 * Fan out a per-registration reject across a selection (no bulk reject endpoint — only
 * approve-all exists). Settles independently per id via `Promise.allSettled`.
 */
export function useBulkRejectRegistrations(divisionId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.divisions.registrations(divisionId);
  return useMutation({
    mutationFn: async (registrationIds: string[]): Promise<BulkActionResult> => {
      const results = await Promise.allSettled(
        registrationIds.map((id) => registrationsApi.rejectRegistration(id)),
      );
      const succeeded: string[] = [];
      const failed: BulkActionResult["failed"] = [];
      results.forEach((result, i) => {
        const id = registrationIds[i]!;
        if (result.status === "fulfilled") succeeded.push(id);
        else failed.push({ id, error: result.reason });
      });
      return { succeeded, failed };
    },
    onMutate: async (registrationIds: string[]) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<RegistrationResponse[]>(key);
      if (previous) {
        const ids = new Set(registrationIds);
        queryClient.setQueryData<RegistrationResponse[]>(
          key,
          previous.map((r) => (ids.has(r.id) ? { ...r, status: "rejected" } : r)),
        );
      }
      return { previous };
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.divisions.participants(divisionId),
      });
    },
  });
}
