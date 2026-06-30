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

### `Cache`
```
get(key: str) -> bytes | None
set(key: str, value: bytes, *, ttl: int) -> None
delete(key: str) -> None
```
- **MVP:** `InMemoryTTLCache` (per-instance) or skip and read Postgres.
- **Scaled:** `RedisCache` (shared across instances).

### `Storage` — files
```
presign_put(key: str, content_type: str, max_size: int) -> PresignedUpload
presign_get(key: str, ttl: int) -> str
public_url(key: str) -> str
```
- **MVP & scaled:** `S3Storage` against **Cloudflare R2** (S3 API). Same implementation throughout; only credentials/bucket change. No swap needed — R2 scales with us.

### `EmailChannel` (one impl of the broader `NotificationChannel`)
```
send(to: Address, template: TemplateId, data: dict) -> DeliveryId
```
- **MVP & scaled:** `ResendEmail`. Adding push/SMS/WhatsApp later = new `NotificationChannel` impls; producers (which only emit outbox events) don't change.

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
