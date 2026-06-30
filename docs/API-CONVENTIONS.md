# Backend & API conventions

The single contract every backend module follows. Set with one trivial module
(`health`) so 10+ modules inherit it instead of improvising. Companion to
`ENGINEERING_GUIDELINES.md`; the shared primitives live in `apps/api/app/api/`.

> Rule of thumb: `core/` = how the app talks to the outside world (infra: config,
> db, ports, logging, events). `api/` = how the outside world talks to the app
> (router aggregator + the cross-cutting contract). Modules never import each
> other; only the aggregator (`app/api/router.py`) imports module routers.

## Module anatomy (vertical slice)

Each feature is `app/modules/<x>/` with these files and responsibilities:

| File | Owns | Must NOT |
|---|---|---|
| `router.py` | HTTP shape: paths, status codes, `response_model`, dependencies. Thin. | Contain business logic or raw SQL. |
| `service.py` | Use cases / orchestration. Raises `AppError` subclasses. Emits outbox events. | Open transactions or commit (the dependency owns the boundary). |
| `repository.py` | SQLAlchemy queries against the session it's given. | Hold a session of its own; leak ORM rows past the service boundary. |
| `schemas.py` | Pydantic request/response models — all extend `ApiModel`. | Re-declare enums (import from `app.db.enums`). |
| `events.py` | Event-type constants + payload schemas for this aggregate. | Dispatch/deliver (that's the poller, later). |

Register the router in `app/api/router.py`. Pure layers (`engine/`, `sports/`)
stay framework-free — never import FastAPI/SQLAlchemy there.

## Transactions, sessions & multi-tenancy (the important one)

- **`get_request_session`** (`app/api/deps.py`) is the request-scoped **unit of
  work**: one transaction with `SET LOCAL app.current_org` set, so Postgres RLS
  applies. Use it for **any handler touching tenant data**. It commits on success,
  rolls back on error. **Services never call `commit()`** — the boundary is the
  dependency. This is what makes the outbox atomic (business row + event in one tx).
- **`get_session`** (`app/core/db.py`) is the bare connection — use **only** for
  system/identity paths that run without an org context (login/bootstrap on the
  `NO_RLS_TABLES`, health, the outbox poller).
- Gotcha (documented in `app/db/rls.py`): tenant tables are `FORCE` RLS'd, so a
  query with no org context returns **zero rows**, not an error. Always go through
  `get_request_session` for tenant data.
- Emit domain events with `app.core.events.emit_event(session, ...)` on the request
  session, so they commit in the same transaction.

## API contract

- **Casing:** JSON is **camelCase** on the wire; Python/DB stay snake_case. Decided
  once in `ApiModel` (`app/api/schemas.py`) via a Pydantic alias generator — every
  request/response schema extends it. Enum *values* are already lowercase wire
  strings shared with `packages/shared`.
- **Success shape:** bare resource bodies (no `{data}` envelope). Collections return
  a typed **`CursorPage[T]`** (`{ items, nextCursor }`).
- **Errors:** **RFC 9457 Problem Details** (`application/problem+json`) for every
  error. Services raise `AppError` subclasses (`NotFoundError`, `ConflictError`,
  `PermissionDeniedError`, `ValidationError`, `PreconditionFailedError`,
  `AuthenticationError`); handlers map them + validation + uncaught errors to a
  stable shape with a `requestId`. Routers stay thin; don't build ad-hoc error JSON.
- **Status codes:** 200 read · 201 create (+ `Location`) · 204 delete · 202
  async-via-outbox · 401/403 auth · 404 not found · 409 conflict · 412 precondition ·
  422 validation.
- **Endpoints:** plural nouns, tenant-scoped paths (`/orgs/{org}/tournaments/{tid}/…`),
  no verbs in paths — actions are sub-resources (`POST …/matches/{id}/score`). Every
  route has exactly one `tags=[...]` (the resource) so operation ids
  (`<tag>_<name>`) and the generated client read well.
- **Versioning:** path-based `/api/v1` (already wired). Breaking changes → `/v2`.

## Pagination, filtering, sorting

- **Cursor pagination** only (`app/api/pagination.py`): `cursor_params` dependency
  (`?cursor=&limit=`, max 100), opaque base64 cursor over `(created_at, id)`,
  `cursor_page(session, stmt, params, entity=Model)` keyset helper → `(rows, nextCursor)`;
  the router maps rows → schema and returns `CursorPage[Schema]`. No OFFSET.
- **Filtering:** explicit allow-listed query params per resource — never a generic
  `?filter=` DSL.
- **Sorting:** `?sort=-created_at` style, allow-listed fields. All list endpoints paginate.

## Auth / authz hooks (seams now, bodies with the auth module)

- `Principal` (`app/api/deps.py`): `user_id`, `organization_id`, `org_role`. Grants/
  assignments added with auth.
- `get_principal` — resolves the caller; raises `NotImplementedError` until auth lands
  (no endpoint depends on it yet; tests override it).
- `require_permission(action)` — authz seam (default-deny). The policy
  `can(principal, action, resource)` lands with auth.

## Idempotency & optimistic concurrency (contract now, machinery later)

- **Idempotency:** mutations accept an `Idempotency-Key` header (`deps.idempotency_key`).
  The protocol: hash method+path+body into `request_hash`; first call inserts
  `idempotency_keys` row `status=started`, stores `response_snapshot` on success,
  replays it on retry; same key + different body → 409. Storage/replay lands with
  the first mutating module (scoring) — it needs the org context.
- **Optimistic concurrency:** use `updated_at` as a weak ETag — emit
  `ETag: W/"<updated_at-epoch>"`, honor `If-Match` → 412 on mismatch. No `version`
  column (the data layer is frozen and `updated_at` is DB-stamped). Build with the
  first mutable resource.

## Observability

- Every request carries `X-Request-ID` (generated if absent, echoed on the response)
  via `RequestContextMiddleware`; every log line and Problem Detail includes it
  (`requestId`). Structured JSON logs (`app/core/logging.py`).

## Generated TypeScript client

`packages/api-client` (not built yet) is **generated** from the API's OpenAPI —
never hand-written, never allowed to drift (the current `apps/web/src/lib/api.ts` is
a temporary placeholder). Operation ids are tuned (`<tag>_<name>`) so client methods
read cleanly. Pick a generator (e.g. `openapi-typescript` / `orval`) and wire CI
codegen when the first business endpoints exist.

## Deliberately deferred (avoid premature abstraction — `ENGINEERING_GUIDELINES §17`)

`BaseRepository`/`BaseService` (document the pattern; extract on the rule-of-three),
the outbox **poller**, full idempotency storage/replay, ETag plumbing, a filter DSL,
and the `realtime/`/`workers/`/`domain/` packages — all have zero consumers today.
Build each with its first real use, not before.
