import type {
  CreateOrgRequest,
  MeResponse,
  OrgResponse,
  OrgSummary,
  PresignUploadResponse,
  UpdateOrgRequest,
} from "@tournament/api-client";

import { api, apiGet } from "@/lib/api";

/** Typed transport for organizations + membership onboarding. Wrapped by `use-orgs` hooks. */

export function listOrgs(): Promise<OrgSummary[]> {
  return apiGet<OrgSummary[]>("/orgs");
}

export async function createOrg(body: CreateOrgRequest): Promise<MeResponse> {
  // Creating an org makes the caller its OWNER and re-mints the access cookie with it active.
  const { data } = await api.post<MeResponse>("/orgs", body);
  return data;
}

export async function updateActiveOrg(body: UpdateOrgRequest): Promise<OrgResponse> {
  const { data } = await api.patch<OrgResponse>("/orgs/active", body);
  return data;
}

export async function switchOrg(organizationId: string): Promise<MeResponse> {
  const { data } = await api.post<MeResponse>("/orgs/switch", { organizationId });
  return data;
}

export async function acceptInvite(token: string): Promise<MeResponse> {
  const { data } = await api.post<MeResponse>("/orgs/invites/accept", { token });
  return data;
}

/**
 * Upload an org logo through the files API (presign → PUT → complete) and return its URL.
 * Requires an active org, so call this AFTER `createOrg`. Best-effort: the raw PUT is a
 * cross-origin call, so callers should treat failures as non-fatal (logo is optional).
 */
export async function uploadOrgLogo(file: File): Promise<string | null> {
  const { data: presign } = await api.post<PresignUploadResponse>("/files", {
    kind: "org_logo",
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
  });
  const res = await fetch(presign.upload.url, {
    method: presign.upload.method,
    headers: presign.upload.headers as Record<string, string>,
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const { data: completed } = await api.post<{ url: string | null }>(
    `/files/${presign.fileId}/complete`,
  );
  return completed.url ?? null;
}
