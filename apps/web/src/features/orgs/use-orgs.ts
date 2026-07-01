"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MeResponse, OrgSummary } from "@tournament/api-client";

import { api, apiGet } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/** Organizations the signed-in user belongs to (for the org switcher). */
export function useOrgs() {
  return useQuery({
    queryKey: queryKeys.orgs.list(),
    queryFn: () => apiGet<OrgSummary[]>("/orgs"),
  });
}

async function switchOrg(organizationId: string): Promise<MeResponse> {
  const { data } = await api.post<MeResponse>("/orgs/switch", { organizationId });
  return data;
}

/**
 * Switch the active org. The API re-mints the access cookie for the new org; we reset
 * the session and drop all tenant-scoped caches so nothing from the old org lingers.
 */
export function useSwitchOrg() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: switchOrg,
    onSuccess: (me) => {
      queryClient.setQueryData(queryKeys.session, me);
      queryClient.clear();
      queryClient.setQueryData(queryKeys.session, me);
    },
  });
}
