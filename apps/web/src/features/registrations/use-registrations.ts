"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RegistrationResponse } from "@tournament/api-client";

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

/** Optimistically flip a registration's status in the list, roll back on error. */
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
