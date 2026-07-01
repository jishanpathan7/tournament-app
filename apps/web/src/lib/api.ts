import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";

import { CSRF_HEADER, isMutating, readCsrfToken } from "@/lib/csrf";
import { env } from "@/lib/env";
import { ApiError, type ProblemDetail, isProblemDetail } from "@/lib/problem";

/**
 * The single API transport. Cookie auth (`withCredentials`), CSRF echo on mutations,
 * one silent token-refresh on 401, and Problem Details → {@link ApiError} normalization.
 * Never call `fetch`/`axios` for the backend elsewhere — add a typed function here and
 * wrap it in a feature query/mutation hook. Request/response shapes come from the
 * generated `@tournament/api-client`, never hand-written.
 */
export const api = axios.create({
  baseURL: `${env.apiUrl}/api/v1`,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// ---- request: CSRF double-submit on mutating verbs ----
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (isMutating(config.method)) {
    const token = readCsrfToken();
    if (token) config.headers.set(CSRF_HEADER, token);
  }
  return config;
});

// Endpoints where a 401 is a real outcome, not an expired access token to refresh.
const NO_REFRESH = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/password-reset"];

type RetryConfig = InternalAxiosRequestConfig & { _retried?: boolean };

let refreshInFlight: Promise<void> | null = null;

function refreshSession(): Promise<void> {
  // De-dupe concurrent 401s onto a single refresh round-trip.
  refreshInFlight ??= api
    .post("/auth/refresh")
    .then(() => undefined)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

/** Fired when the session is unrecoverable (refresh failed). The auth provider listens. */
export const AUTH_EXPIRED_EVENT = "auth:expired";

function toApiError(error: AxiosError): ApiError {
  const data = error.response?.data;
  if (isProblemDetail(data)) return new ApiError(data);
  const status = error.response?.status ?? 0;
  const problem: ProblemDetail = {
    type: "about:blank",
    title: error.response?.statusText || "Request failed",
    status,
    code: status === 0 ? "network_error" : "unexpected_error",
    detail: error.message,
  };
  return new ApiError(problem);
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;
    const status = error.response?.status;
    const url = config?.url ?? "";
    const refreshable =
      status === 401 && !!config && !config._retried && !NO_REFRESH.some((p) => url.includes(p));

    if (refreshable && config) {
      config._retried = true;
      try {
        await refreshSession();
        return api(config);
      } catch {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
        }
      }
    }
    return Promise.reject(toApiError(error));
  },
);

/** Typed GET helper. Prefer feature hooks over calling this directly. */
export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await api.get<T>(url, config);
  return data;
}

export interface Health {
  status: string;
  service: string;
  version: string;
  environment: string;
  time: string;
}

export async function fetchHealth(): Promise<Health> {
  return apiGet<Health>("/health");
}
