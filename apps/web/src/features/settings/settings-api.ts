/**
 * Settings API transport — uses local interfaces rather than the generated client
 * because the generated client is not regenerated on every backend schema change.
 * All fields use camelCase (the wire format produced by the ApiModel alias_generator).
 */

import { api, apiGet } from "@/lib/api";

export interface OrgSettings {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  plan: string;
  branding: Record<string, unknown>;
  emailsEnabled: boolean;
}

export interface UpdateOrgSettingsRequest {
  name?: string;
  timezone?: string;
  emailsEnabled?: boolean;
}

export function getActiveOrgSettings(): Promise<OrgSettings> {
  return apiGet<OrgSettings>("/orgs/active");
}

export async function updateOrgSettings(body: UpdateOrgSettingsRequest): Promise<OrgSettings> {
  const { data } = await api.patch<OrgSettings>("/orgs/active", body);
  return data;
}
