"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as settingsApi from "@/features/settings/settings-api";
import { queryKeys } from "@/lib/query-keys";

export function useOrgSettings() {
  return useQuery({
    queryKey: queryKeys.orgs.active(),
    queryFn: settingsApi.getActiveOrgSettings,
  });
}

export function useUpdateOrgSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: settingsApi.updateOrgSettings,
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.orgs.active(), updated);
    },
  });
}
