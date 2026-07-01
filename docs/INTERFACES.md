# Swappable infrastructure interfaces

This is the seam that lets us run **free at MVP** and **upgrade to paid services without refactoring**. Every piece of infrastructure that has a "free single-instance" version and a "paid scaled" version sits behind a small interface. Application code depends on the interface; a factory picks the implementation from env vars at startup.

> Signatures below are **contracts, not implementations** — conceptual shapes to design against. No code is written yet.

## The rule

- Domain/service code **never** imports a concrete backend (no `import redis`, no `boto3` in a handler).
- It depends on an interface from `apps/api/app/core/ports/`.
- A factory in `core/factory.py` wires the implementation based on `ENVIRONMENT` / provider env vars.
- Swapping free→paid = change env vars + (sometimes) one factory line. No domain change.

## Interfaces

### `PubSub` — realtime fan-out
```
publish(channel: str, event: Event) -> None
subscribe(channel: str) -> AsyncIterator[Event]
```
- **MVP:** `InProcessPubSub` — an in-memory asyncio broker. Works because there's one instance; WS/SSE subscribers share the process.
- **Scaled:** `RedisPubSub` (Upstash) or a managed provider adapter (Ably/Pusher) for cross-instance fan-out.

### `JobQueue` — background work
```
enqueue(task: str, payload: dict, *, run_at: datetime | None) -> JobId
```
- **MVP:** `OutboxPoller` — an in-process async loop that reads the `outbox` table and runs handlers (notifications, standings recompute, exports). The outbox already exists for reliability, so no extra infra.
- **Scaled:** `ArqQueue` (Redis-backed) so jobs run on dedicated worker instances.

### `Cache` (implemented)
```
get(key: str) -> bytes | None
set(key: str, value: bytes, *, ttl: int) -> None
delete(key: str) -> None
```
- **MVP:** `InMemoryCache` (`app/cache/memory.py`) — dict + lazy TTL expiry, injectable clock, process-local. Wired by `factory.get_cache`.
- **Scaled:** `RedisCache` (shared across instances) drops in behind the same port when `REDIS_URL` is set. `app/cache/get_json`/`set_json` are impl-agnostic helpers for the common dict-caching case.

### `Storage` — files (implemented)
```
presign_put(key, content_type, max_size) -> dict   # {url, method, headers, maxSize, expiresIn}
presign_get(key, ttl) -> str
public_url(key) -> str
delete(key) -> None
stat(key) -> StoredObject | None                    # size + content_type (HEAD)
read(key) -> bytes | None                           # for server-side image probing
```
- **Prod:** `R2Storage` (`app/storage/r2.py`) against **Cloudflare R2** via the boto3 S3 API — presigned PUT/GET so bytes never transit the API. Selected automatically when the four `R2_*` settings are present.
- **Dev:** `LocalStorage` (`app/storage/local.py`) keeps objects on disk and serves them through HMAC-signed `PUT/GET /files/local/{key}` endpoints (no R2 credentials needed). Chosen by `factory.get_storage` when R2 is unconfigured.
- **Module:** `app/modules/files` (presign → complete → download → delete); per-kind MIME/size/visibility policy in `app/storage/policy.py`; dependency-free image dimension probing in `app/storage/images.py`. Same `Storage` contract at MVP and scale.

### `EmailChannel` (implemented — one impl of the broader `NotificationChannel`)
```
send(to: str, template: str, data: dict) -> str   # returns a delivery/message id
```
- **Prod:** `ResendEmailChannel` (`app/emails/resend_channel.py`) — renders then sends via Resend. Selected when `RESEND_API_KEY` is set.
- **Dev:** `LogEmailChannel` — renders the subject and logs the payload (token links included) so flows work end-to-end with no secret.
- **Rendering:** `app/emails/renderer.py` (Jinja2) is the single place a `(template, data)` pair becomes subject + HTML + plaintext, using the shared layout in `templates/layouts/base.html`. `StrictUndefined` makes a template/data mismatch a loud error. Callers pass a template id + data only — **never raw HTML/subjects**. Templates: `verify_email`, `password_reset`, `org_invite`. Adding push/SMS/WhatsApp later = new `NotificationChannel` impls; producers don't change.

### `AuthService` — identity
```
authenticate(credentials) -> Principal
issue_tokens(user) -> TokenPair
verify_access(token) -> Principal
rotate_refresh(token) -> TokenPair
```
- **MVP:** `FirstPartyAuth` (JWT + rotating refresh, Argon2id). Free; we own it.
- **Alternative:** `ClerkAuth` / `Auth0Auth` / `SupabaseAuth` adapter if we later want managed auth — same interface, swap behind the factory.

## What is NOT swappable (deliberately)

- **PostgreSQL** is the system of record everywhere (Neon free → Neon paid → larger Postgres). Standard wire protocol, so the host changes, not the dependency.
- **The Format Engine and Sport Profiles** are pure domain logic, not infra — they never change when infra does.

## Decision log

| Date | Decision |
|---|---|
| 2026-06 | MVP runs single-instance: `InProcessPubSub`, `OutboxPoller`, `InMemoryTTLCache`. Redis introduced only at horizontal scale. |
| 2026-06 | `S3Storage`→R2 and `ResendEmail` used at both MVP and scale (no swap planned). |
| 2026-06 | First-party auth for MVP; managed-auth adapters kept as a future option behind `AuthService`. |
| 2026-06 | UUIDv7 PKs generated app-side via `uuid6.uuid7()` (Postgres has no native `uuidv7()` before PG18). |
| 2026-06 | Multi-tenant isolation via Postgres **RLS**, scoped by `SET LOCAL app.current_org` (`app/db/session.py:set_org_context`). Tenant tables use **FORCE** RLS so the owner role is subject too; the app should connect as a non-superuser role in prod (superusers bypass RLS). Per-request org-context wiring ships with auth. |
| 2026-06 | Identity/bootstrap tables (`users`, `organizations`, `memberships`, `identities`, `auth_sessions`, `org_invites`, `share_links`) + system `outbox` are **excluded from RLS** (read before an org context exists / capability lookups / context-less poller). `memberships`/`org_invites`/`share_links` are tenant data on app-discipline only — **close with auth** via an `app.current_user` GUC + policy; track a cross-tenant read test. |
| 2026-06 | **No table partitioning at MVP.** `matches`/`match_result_events`/`audit_logs`/`notifications`/`outbox` are the future range-partition candidates (by `created_at`; UUIDv7 PKs already encode time). Deferred — partitioning forces the partition key into PKs/uniques and complicates FKs; revisit at first high-volume multi-org tournament. |
