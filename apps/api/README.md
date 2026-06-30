# apps/api — backend

Python FastAPI (async) + SQLAlchemy 2.0 + Alembic + Pydantic v2. Deploys to Railway/Render (API + an in-process worker loop at MVP).

> Status: not yet scaffolded. This README describes the intended structure.

## Layout

```
app/
  main.py        ASGI app, router mounting, middleware
  core/          config, security, db session, ports/ (interfaces), factory, logging
  domain/        entities & value objects (sport-agnostic)
  modules/       vertical slices — each: router · service · repository · schemas · events
    orgs/ tournaments/ registrations/ participants/ scheduling/
    scoring/ standings/ sharing/ files/ notifications/
  engine/        Format Engine — PURE, no framework imports
    formats/ (round_robin, single_elim, group_knockout, swiss, ladder)
    seeding.py, standings.py
  sports/        Sport Profiles — pluggable
    registry.py, badminton.py, chess.py(future)
  realtime/      ws manager, sse, pubsub bridge (via core/ports)
  workers/       task handlers (run in-process at MVP via OutboxPoller; ARQ when scaled)
  migrations/    Alembic
```

## Hard rules

- `engine/` and `sports/` import **nothing** from FastAPI/SQLAlchemy — pure, unit-testable domain logic.
- No sport conditionals in the core. A `Match` carries a generic `result_payload` validated by its Sport Profile; the engine consumes only the abstract outcome.
- All infra access goes through `core/ports/` interfaces (`PubSub`, `JobQueue`, `Cache`, `Storage`, `EmailChannel`, `AuthService`). See [`docs/INTERFACES.md`](../../docs/INTERFACES.md).
- Every tenant query is scoped by `organization_id`; Postgres RLS is the backstop.
- API contract is the source of truth — OpenAPI regenerates `packages/api-client` in CI.

## Conventions

- All routes under one `APIRouter(prefix="/api/v1")`; mount CORS **after** including routers.
- String UUID ids (UUIDv7) on every row; never leak internal sequence ids.
- **Cookie-based JWT** auth: `set_auth_cookies` derives `secure`/`samesite` from the base-URL scheme. No bearer tokens. Idempotent admin seed from `ADMIN_EMAIL`/`ADMIN_PASSWORD` on startup.
- RFC 9457 Problem Details for errors; cursor pagination; `Idempotency-Key` on mutations.
- PATCH: never overload `null` to mean "clear" — use `clear_<field>: true` flags.
- Domain side effects via the transactional `outbox` (write business row + event in one transaction).
- Deps pinned in `requirements.txt`; rationale + dropped libs in `docs/STACK.md`.

## Env vars

See [`docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md) → backend section.
