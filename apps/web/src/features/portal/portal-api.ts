import type { PortalHomeView } from "@tournament/api-client";
import { apiGet } from "@/lib/api";

export function getPortalHome(): Promise<PortalHomeView> {
  return apiGet<PortalHomeView>("/me/portal");
}
