/**
 * RFC 9457 Problem Details — the API's error contract (`app/api/errors.py`).
 *
 * Every backend error is `application/problem+json` with a stable `code` that
 * distinguishes cases (e.g. `unauthorized`, `csrf_failed`, `validation_error`,
 * `stale_match`). The axios error interceptor normalizes failures into `ApiError`
 * so callers read one shape regardless of transport-vs-HTTP-vs-network failure.
 */

export interface ProblemFieldError {
  field?: string;
  message: string;
  type?: string;
}

export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code: string;
  requestId?: string;
  errors?: ProblemFieldError[];
}

/** A normalized API failure. `status === 0` means the request never reached the server. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly fieldErrors: ProblemFieldError[];

  constructor(problem: ProblemDetail) {
    super(problem.detail || problem.title || "Request failed");
    this.name = "ApiError";
    this.status = problem.status;
    this.code = problem.code;
    this.requestId = problem.requestId;
    this.fieldErrors = problem.errors ?? [];
  }

  get isAuth(): boolean {
    return this.status === 401 || this.code === "unauthorized";
  }
  get isForbidden(): boolean {
    return this.status === 403;
  }
  get isNotFound(): boolean {
    return this.status === 404;
  }
  get isConflict(): boolean {
    return this.status === 409;
  }
  get isValidation(): boolean {
    return this.status === 422 || this.code === "validation_error";
  }
  get isNetwork(): boolean {
    return this.status === 0;
  }
}

export function isProblemDetail(value: unknown): value is ProblemDetail {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    "code" in value &&
    typeof (value as ProblemDetail).code === "string"
  );
}

/** Best-effort human message for a failure, preferring the server's `detail`. */
export function errorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof ApiError) {
    if (error.isNetwork) return "Can't reach the server. Check your connection and retry.";
    return error.message || fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
