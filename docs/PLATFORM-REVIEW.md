# Platform Infrastructure — Final Foundation Review

Review of the platform-infrastructure milestone (Parts 1–8) before Tournament modules
begin. Scope: the reusable platform layer only — no tournament business logic exists yet.

## What was built

| Part | Capability | Key modules | Migration |
|---|---|---|---|
| 1 | File storage (R2 + local, presigned, validation, image metadata) | `app/storage/`, `app/modules/files/` | 0003 |
| 2 | Caching (in-process TTL, Redis seam) | `app/cache/` | — |
| 3 | Email (Jinja2 render + Resend, layouts) | `app/emails/` | — |
| 4 | Background jobs (outbox poller, retry/dead-letter) | `app/workers/` | 0004 |
| 5 | Notifications (in-app + email, channel-abstracted) | `app/modules/notifications/` | 0005 |
| 6 | Realtime (PubSub broadcaster + SSE transport) | `app/realtime/` | — |
| 7 | Feature flags (global/org/user + rollout) | `app/modules/flags/` | 0006 |
| 8 | Observability (timing, metrics/tracing hooks, audit, readiness) | `app/core/{metrics,tracing,audit}`, middleware, health | — |

Everything sits behind the swappable ports in `app/core/ports.py` (`Storage`, `Cache`,
`JobQueue`, `PubSub`, `EmailChannel`, `Metrics`, `Tracer`) — free→paid is a
`factory.py` swap, never a refactor (see `docs/INTERFACES.md`).

## Validation

**Module boundaries.** Vertical slices (router/service/repository/schemas/events) hold.
No module imports another module's **router**; only `app/api/router.py` aggregates them.
Pure/infra layers (`storage`, `cache`, `emails`, `realtime`, `workers`) carry no HTTP
concerns. One accepted cross-module dependency: `orgs → auth` (`build_me` / `MeResponse`)
— orgs re-mints the session "me" view on org switch/create. It is **acyclic** (auth never
imports orgs) and reflects real layering (orgs builds on the identity foundation).

**Dependency direction.** `core/` imports no modules at module scope. The only
module reference from the DI layer is `deps.require_flag`'s **lazy** import of the flags
service (inside the dependency), which keeps the import graph acyclic. Workers discover
handlers via an explicit module list. Clean.

**Sport-agnostic core.** No `if sport == …` anywhere (`grep` clean). Nothing in the
platform layer encodes a sport — the whole point of doing infra before tournaments.

**Security.**
- Multi-tenancy: every tenant table is `FORCE` RLS'd; `get_request_session` sets the
  org GUC so queries self-scope. `feature_flags` is deliberately NO_RLS (global rows have
  no org) and its management API scopes writes/deletes to the caller's active org explicitly.
- CSRF: all authenticated mutations use `authed_csrf` (401-before-403 ordering).
- Authz: pure default-deny policy; routers never embed authz (`require_permission` /
  `require_flag`). New actions `file:*`, `feature_flag:manage` added to the matrix.
- Storage: local dev endpoints are HMAC-signed and 404 under R2; path-traversal guarded.
- Jobs run each handler in a SAVEPOINT so a failure can't commit partial writes.
- Secrets: `grep` clean — no hardcoded credentials (placeholders only in `.env.example`).

**Performance.** Keyset (cursor) pagination everywhere; indexes on hot lookups
(`feature_flags.key`, `notifications.recipient`, partial `outbox` unprocessed index);
`selectinload` avoids N+1 on membership lists; boto3/Resend sync calls offloaded to
threads. Minor future optimization: `flags.is_enabled` does up to 3 point lookups
(user/org/global) — fine at MVP; collapsible to one query later if it ever shows up.

**Maintainability.** Consistent module anatomy, camelCase `ApiModel` wire contract,
RFC 9457 errors, additive/idempotent migrations that round-trip cleanly, docstrings on
every seam, `docs/INTERFACES.md` current.

**Test coverage.** 19 test files / 112 tests: unit (pure logic, hooks) + integration
(DB-backed, full HTTP lifecycles) + metadata guards (table/enum/RLS classification) +
migration round-trip + zero autogenerate drift.

## Verdict

The platform layer is production-ready for MVP and provides clean, swappable seams for
scale. No blocking issues. Tournament modules can now build on it.

## Deferred (by design, not gaps)

Redis-backed cache/pubsub/queue, OTel exporters, WhatsApp/Slack/Push channels, WebSocket
transport, idempotency storage/replay, ETag concurrency — all have their seam in place and
land with their first real consumer (`ENGINEERING_GUIDELINES §17`, avoid premature abstraction).
