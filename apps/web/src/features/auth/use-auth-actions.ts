"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MeResponse } from "@tournament/api-client";

import {
  confirmEmail,
  login,
  logout,
  register,
  requestEmailVerification,
} from "@/features/auth/auth-api";
import type { LoginValues, RegisterValues } from "@/features/auth/schemas";
import { queryKeys } from "@/lib/query-keys";

/** Prime the session cache from an auth response so the app reflects sign-in instantly. */
function useSeedSession() {
  const queryClient = useQueryClient();
  return (me: MeResponse) => {
    queryClient.setQueryData(queryKeys.session, me);
    void queryClient.invalidateQueries({ queryKey: queryKeys.orgs.all });
  };
}

export function useLogin() {
  const seed = useSeedSession();
  return useMutation({
    mutationFn: (values: LoginValues) => login(values),
    onSuccess: seed,
  });
}

export function useRegister() {
  const seed = useSeedSession();
  return useMutation({
    mutationFn: (values: RegisterValues) => register(values),
    onSuccess: seed,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.session, null);
      queryClient.clear();
    },
  });
}

/** Confirm an email-verification token, then refresh the session so `emailVerified` updates. */
export function useConfirmEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => confirmEmail(token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.session });
    },
  });
}

export function useResendVerification() {
  return useMutation({ mutationFn: requestEmailVerification });
}
