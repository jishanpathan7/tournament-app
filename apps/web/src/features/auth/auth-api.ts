import type { LoginRequest, MeResponse, RegisterRequest } from "@tournament/api-client";

import { api, apiGet } from "@/lib/api";
import { ApiError } from "@/lib/problem";

/** Current session, or `null` when unauthenticated (401 is an expected outcome here). */
export async function fetchSession(): Promise<MeResponse | null> {
  try {
    return await apiGet<MeResponse>("/auth/me");
  } catch (error) {
    if (error instanceof ApiError && error.isAuth) return null;
    throw error;
  }
}

export async function login(body: LoginRequest): Promise<MeResponse> {
  const { data } = await api.post<MeResponse>("/auth/login", body);
  return data;
}

/** Register — the endpoint signs the user in (sets auth cookies) and returns the session. */
export async function register(body: RegisterRequest): Promise<MeResponse> {
  const { data } = await api.post<MeResponse>("/auth/register", body);
  return data;
}

export async function logout(): Promise<void> {
  await api.post("/auth/logout");
}

export async function confirmEmail(token: string): Promise<void> {
  await api.post("/auth/verify-email/confirm", { token });
}

export async function requestEmailVerification(): Promise<void> {
  await api.post("/auth/verify-email/request");
}
