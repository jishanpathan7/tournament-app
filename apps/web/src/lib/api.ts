import axios from "axios";

import { env } from "@/lib/env";

/**
 * Shared API client. Cookie-based auth → `withCredentials`.
 * Base URL is the backend root; we append the documented `/api/v1` prefix here.
 * NOTE: this hand-written client is a placeholder until the OpenAPI-generated
 * client lands in `packages/api-client` (see docs/STACK.md). Do not add bespoke
 * fetch calls elsewhere — extend this module.
 */
export const api = axios.create({
  baseURL: `${env.apiUrl}/api/v1`,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

export interface Health {
  status: string;
  service: string;
  version: string;
  environment: string;
  time: string;
}

export async function fetchHealth(): Promise<Health> {
  const { data } = await api.get<Health>("/health");
  return data;
}
