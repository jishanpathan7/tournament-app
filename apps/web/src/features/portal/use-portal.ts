import { useQuery } from "@tanstack/react-query";

import * as portalApi from "@/features/portal/portal-api";

export function usePortalHome() {
  return useQuery({
    queryKey: ["portal", "home"],
    queryFn: portalApi.getPortalHome,
  });
}
