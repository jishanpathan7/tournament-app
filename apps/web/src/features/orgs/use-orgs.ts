"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MeResponse } from "@tournament/api-client";

import * as orgsApi from "@/features/orgs/orgs-api";
import { queryKeys } from "@/lib/query-keys";

/** Organizations the signed-in user belongs to (for the switcher + selector). */
export function useOrgs() {
  return useQuery({
    queryKey: queryKeys.orgs.list(),
    queryFn: orgsApi.listOrgs,
  });
}

/** Members of the active org — e.g. to resolve who submitted a registration. */
export function useOrgMembers(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.orgs.members(),
    queryFn: orgsApi.listMembers,
    enabled: options?.enabled ?? true,
  });
}

/** Seed the session cache from a fresh MeResponse and drop tenant-scoped caches. */
function useApplySession() {
  const queryClient = useQueryClient();
  return (me: MeResponse) => {
    queryClient.clear();
    queryClient.setQueryData(queryKeys.session, me);
  };
}

/**
 * Switch the active org. The API re-mints the access cookie for the new org; we reset
 * the session and drop all tenant-scoped caches so nothing from the old org lingers.
 */
export function useSwitchOrg() {
  const apply = useApplySession();
  return useMutation({
    mutationFn: orgsApi.switchOrg,
    onSuccess: apply,
  });
}

/** Create an organization → caller becomes OWNER, session re-mints with it active. */
export function useCreateOrg() {
  const apply = useApplySession();
  return useMutation({
    mutationFn: orgsApi.createOrg,
    onSuccess: apply,
  });
}

/** Patch the active org (name / timezone / branding). */
export function useUpdateActiveOrg() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: orgsApi.updateActiveOrg,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.orgs.active() });
    },
  });
}

/** Accept an invitation → join the org, session re-mints with it active. */
export function useAcceptInvite() {
  const apply = useApplySession();
  return useMutation({
    mutationFn: orgsApi.acceptInvite,
    onSuccess: apply,
  });
}
