import { useQuery } from "@tanstack/react-query";

import * as portalApi from "@/features/portal/portal-api";
import { queryKeys } from "@/lib/query-keys";

export function usePortalHome() {
  return useQuery({
    queryKey: queryKeys.portal.home(),
    queryFn: portalApi.getPortalHome,
  });
}
