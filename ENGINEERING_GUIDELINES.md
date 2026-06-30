# Engineering Guidelines

> The reference for **all** development on this platform — humans and AI agents alike. Read it before writing code. It encodes how we build so every feature stays consistent, scalable, and high-quality. Pairs with `CLAUDE.md` (quick context), `Technical-Architecture.md` (the system), `docs/STACK.md` (pinned tools), and `docs/DESIGN-SYSTEM.md` (the UI).

## 0. The prime directive — reuse before you create

**Before writing any new code, search for what already exists and extend it.** Duplicate implementations are the #1 thing to avoid.

- Need a UI element? Check `apps/web/src/components/ui/` and `apps/web/src/components/` first.
- Need data from the API? Use the API client in `apps/web/src/lib/api.ts` and wrap it in a hook under the relevant `features/`. Never hand-roll `fetch`/`axios` calls elsewhere.
- Need a domain type or pure helper shared by web + (mirrored in) API? It belongs in `packages/shared` (e.g. `skillWeight`, `SkillLevel`). Check there before defining a new one.
- Need infrastructure (cache, pub/sub, storage, email, auth)? Use the `app/core/ports.py` interfaces — never import a concrete backend (`redis`, `boto3`) directly in a handler.
- Backend business logic? Look for an existing module under `apps/api/app/modules/` before adding a new slice.

If you genuinely need something new, build it in the **smallest correct scope** (see §17) and make it reusable from the start.

---

## 1. Architecture & folder structure

Monorepo (Turborepo + yarn workspaces). Three planes, one sport-agnostic core.

```
apps/
  web/      Next.js 15 frontend (App Router, RSC)
  api/      FastAPI backend (engine/ formats · sports/ profiles · modules/ slices · workers/)
packages/
  shared/   Cross-cutting TS types + pure utils (single source of truth)
  config/   Shared Tailwind preset + base tsconfig
  ui/       (future) generated shadcn component library
  api-client/ (future) OpenAPI-generated TS client
docs/       Canonical specs (architecture, stack, design system, interfaces, deployment)
```

**The one rule that governs everything (from `CLAUDE.md`):** keep three layers separate — the **Format Engine** (`apps/api/app/engine/`, sport-agnostic), the **Sport Profile** (`apps/api/app/sports/`, pluggable), and the **Domain Core** (`Organization → Tournament → Division → Stage → Group/Round → Match → Standing`). Never leak sport logic into the engine or core. If you write `if sport == "badminton"`, stop.

**Backend modules are vertical slices.** Each `modules/<feature>/` contains:
- `router.py` — HTTP endpoints (thin; no business logic)
- `service.py` — use cases / transactions (the logic)
- `repository.py` — data access (SQLAlchemy queries)
- `schemas.py` — Pydantic request/response models
- `events.py` — domain events emitted to the outbox

**Frontend is organized by feature.** `apps/web/src/`:
- `app/` — routes only (route groups `(public)`, `(console)`, `(portal)`, `(auth)`); pages stay thin and compose features.
- `features/<feature>/` — feature logic: hooks (`use-*.ts`), feature components, types.
- `components/ui/` — design-system primitives (Button, etc.); `components/` — shared app components.
- `lib/` — cross-cutting wiring (`api.ts`, `env.ts`, `utils.ts`).

---

## 2. Coding standards & naming conventions

| Context | Convention | Example |
|---|---|---|
| Python modules, functions, vars | `snake_case` | `def compute_standings()` |
| Python classes | `PascalCase` | `class TournamentService` |
| DB tables / columns | `snake_case` | `match_result_events` |
| TS variables, functions | `camelCase` | `fetchHealth` |
| TS types, components, classes | `PascalCase` | `type MatchStatus`, `function HealthStatus()` |
| TS constants | `UPPER_SNAKE_CASE` | `SKILL_WEIGHT` |
| Web files & routes | `kebab-case` | `health-status.tsx`, `/t/[slug]` |
| React hooks | `use` prefix, kebab file | `useHealth` in `use-health.ts` |
| Booleans | `is/has/should` prefix | `isLoading`, `hasPartner` |
| Event/log names | dotted | `api.startup`, `match.scored` |

- IDs are string UUIDs everywhere (never expose sequential ints).
- API routes live under `/api/v1`; the web client appends the prefix (see `lib/api.ts`).
- No abbreviations that aren't obvious. Name for the reader, not the writer.

---

## 3. TypeScript best practices

- **`strict` is on**, plus `noUncheckedIndexedAccess` and `noImplicitOverride` (see `packages/config/tsconfig.base.json`). Respect them — handle `undefined` from index access.
- **No `any`.** Use `unknown` + narrowing, generics, or a real type. `eslint`/`tsc` will fight you; let them win.
- Prefer **`type`** for unions/aliases, **`interface`** for object shapes that may be extended (e.g. component props).
- Derive types from runtime sources: `z.infer<typeof schema>` for forms, generated client types for API data — don't hand-duplicate shapes.
- Use **discriminated unions** for state (`{ status: "loading" } | { status: "error"; error }`), not boolean soups.
- Keep shared cross-app types in `packages/shared` (`SkillLevel`, `MatchStatus`, …). Import them; don't redefine.
- Access env only through `lib/env.ts` — never `process.env.X` inline.

---

## 4. Component design principles (frontend)

- **Server Components by default.** Add `"use client"` only when you need state, effects, event handlers, or browser APIs. Push client boundaries to the leaves.
- **Pages are thin.** A route file composes features; it holds no business logic.
- **Three component tiers:** `components/ui/` (design-system primitives, no business logic) → `components/` (shared app components) → `features/<x>/` (feature-specific). A component used by 2+ features moves up a tier.
- **Variants via CVA**, classes merged via `cn()` (`lib/utils.ts`). Model the Button pattern (`components/ui/button.tsx`): tones/sizes as variants, never ad-hoc class strings scattered around.
- **Strictly follow the design system** (`docs/DESIGN-SYSTEM.md`): tokens only, the density-tier rule, no new hex values, pink (not red) for errors.
- Components receive data via props or feature hooks — they don't fetch inline. Keep them presentational where possible.
- Accessibility is not optional: label icon-buttons, use semantic elements, keep the focus ring (§ design system).

---

## 5. State management

- **Server state → TanStack Query** (`features/*/use-*.ts`). One query key per resource; configure `staleTime`; mutations invalidate. Never mirror server data into local state.
- **Forms → react-hook-form + zod** (`@hookform/resolvers`). The zod schema is the validation source of truth; infer the TS type from it.
- **URL is state** for shareable/navigable things (filters, tabs, selected division) — use search params, not local state.
- **Local UI state → `useState`/`useReducer`**, colocated in the component.
- **No global store** (Redux/Zustand) unless a real cross-tree need emerges — justify it in review first. Most "global" needs are server state (Query) or URL state.

---

## 6. API design patterns (backend)

- **REST, resource-oriented, tenant-scoped** under `/api/v1`: `…/orgs/{org}/tournaments/{tid}/…`.
- **Vertical slices** (§1). Routers are thin and delegate to services; services own transactions; repositories own queries. No SQL in routers.
- **Errors = RFC 9457 Problem Details** (`type`, `title`, `status`, `detail`, `errors[]`) via a central exception handler. One error shape everywhere.
- **Pagination** is cursor-based (`?cursor=&limit=`), stable order by `(created_at, id)`.
- **Idempotency:** mutating endpoints accept an `Idempotency-Key` (critical for score submits over flaky wifi).
- **PATCH semantics:** never overload `null` to mean "clear" — use an explicit `clear_<field>: true` flag.
- **The contract is the source of truth:** FastAPI OpenAPI → generated TS client (`packages/api-client`). Never hand-write the client or let it drift.
- **Side effects go through the transactional outbox** (write business row + event in one transaction), then workers fan out (notifications, standings recompute, realtime).

---

## 7. Backend service & dependency patterns

- **Dependency injection via FastAPI `Depends`** — sessions (`get_session`), the current principal, settings. Don't reach for globals.
- **Infrastructure behind `app/core/ports.py`** (`PubSub`, `JobQueue`, `Cache`, `Storage`, `EmailChannel`, `AuthService`). Code depends on the Protocol; a factory picks the impl from settings. This is the free→paid seam — keep it intact (`docs/INTERFACES.md`).
- **`engine/` and `sports/` import zero framework code** — pure, deterministic, unit-testable. All sport behavior is a Sport Profile data structure + small validator, never a conditional in the core.
- **Multi-tenancy is enforced at three layers:** app query scoping by `organization_id` → policy layer → Postgres RLS. Every tenant query is scoped; never trust a client-supplied org id.

---

## 8. Validation patterns

- **Validate at the boundaries, trust the inside.** Pydantic validates everything entering the API; zod validates everything entering a form. Past the boundary, types are trusted.
- The **Sport Profile validates `result_payload`** (a generic JSONB) — the engine only ever sees a validated abstract outcome.
- Shared enums/unions live in `packages/shared` and are mirrored by backend Pydantic — keep them in sync (the generated client closes most of this gap).
- Fail with specific, user-actionable messages; map validation errors into the Problem Details `errors[]` array.

---

## 9. Error handling strategy

**Backend:**
- Raise typed domain exceptions; a central handler converts them to Problem Details. Never leak stack traces or internal messages to clients.
- Health/probe code never raises (see `check_db()` — returns a status instead).
- Catch narrowly. A bare `except` needs a `# noqa` and a comment justifying it.

**Frontend:**
- TanStack Query exposes `isError`/`error` — render explicit error states (see `HealthStatus`), never a blank screen.
- Use **error boundaries** for unexpected render failures; **sonner** toasts for transient action failures.
- Never swallow errors silently. If you catch, you handle (retry, toast, or surface) — or you don't catch.
- For optimistic mutations (e.g. live scoring), roll back on failure and notify.

---

## 10. Logging standards

- **Backend:** structured JSON via `app/core/logging.py`. Log **events**, not prose: `logger.info("match.scored", extra={"match_id": id})`. Include `org_id`/`request_id` where available. Levels: `DEBUG` (dev detail), `INFO` (lifecycle/business events), `WARNING` (recoverable), `ERROR` (needs attention). Errors also go to Sentry when `SENTRY_DSN` is set.
- **Frontend:** no `console.log` in committed code. Use a thin logger wrapper for dev; ship meaningful errors to Sentry.
- **Never log secrets, tokens, passwords, or PII.** The public plane and logs never contain PII.

---

## 11. Reusable component & utility patterns

- `cn()` for class merging; `lib/api.ts` as the single API entry; `lib/env.ts` for env.
- Design-system primitives in `components/ui/`; promote a component up a tier when a second consumer appears.
- Pure, cross-app logic → `packages/shared` (typed, tested, no React/framework imports). The fairness `skillWeight`/`teamStrength` helpers are the model.
- Backend reusable infra → `core/`; reusable domain rules → `engine/`/`sports/`; feature logic → its module's `service.py`.
- Prefer composition over configuration-heavy mega-components. Small, named, single-purpose units.

---

## 12. Performance

- **Lean on RSC + Suspense** so shells paint instantly; keep client bundles small (push `"use client"` to leaves).
- **Public plane is cache-first:** ISR + CDN; live data layered via SSE. A viral tournament page should cost ~no DB per view.
- **TanStack Query** dedupes and caches; set sensible `staleTime`; don't refetch on every focus.
- `memo`/`useMemo`/`useCallback` only for measured hot paths — not by reflex.
- **Backend:** index every `org_id`/`tournament_id` lookup; avoid N+1 (eager-load or batch); paginate all lists; standings are materialized, not recomputed per request.
- Optimize after measuring. Clarity first; speed where it counts.

---

## 13. Security

- **Multi-tenant isolation is sacred:** `organization_id` on every tenant row, scoped in queries, enforced by RLS. Never query across tenants.
- **Auth is cookie-based JWT** (HTTP-only; `secure`/`samesite` from scheme). No tokens in JS/localStorage. CSRF-protect cookie mutations.
- **Authorization is default-deny**, checked centrally (`can(principal, action, resource)`): org role → tournament grant → match-level assignment.
- Validate and bound all input; never trust client-supplied ids or roles.
- Secrets only via env (`.env`, never committed). Rotate-able `JWT_SECRET`. Least-privilege everywhere.
- Public artifacts: only `visibility != private` + published, and never PII.
- Audit privileged actions (result overrides, draw locks, role changes).
- Keep dependencies current; CI dependency scanning before release.

---

## 14. Testing expectations

- **`engine/` and `sports/` must be unit-tested** — they're pure and carry the fairness/standings logic; bugs here are the most damaging. Cover edge cases (byes, ties, walkovers, skew).
- **Service-layer tests** for each module's use cases (real Postgres via testcontainers when DB is involved).
- **Contract tests** assert OpenAPI ↔ generated client agree.
- **Frontend:** unit-test non-trivial hooks/utils; component tests for stateful UI; **Playwright e2e** for critical flows (register → seed → score → standings) as they're built.
- A bug fix ships with a regression test. Test behavior, not implementation. Don't chase a coverage number — cover what would hurt if it broke.
- Tests must pass before merge (see §19).

---

## 15. Documentation standards

- **Docstrings** on Python modules/public functions explaining *why* and contracts (see existing `core/` modules). **JSDoc** on non-obvious TS utils/components.
- Comments explain **why**, not what. Delete commented-out code.
- **Update the canonical docs** when behavior changes — don't fork a decision into a new file. Architecture → `Technical-Architecture.md`; product → `Platform-Product-Spec.md`; UI → `docs/DESIGN-SYSTEM.md`; infra seams → `docs/INTERFACES.md`.
- Each top-level folder keeps a `README.md` describing its purpose.
- Significant/irreversible decisions get a short decision-log entry (see `docs/INTERFACES.md`).

---

## 16. Git & PR best practices

- **Conventional Commits:** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:` (+ optional scope, e.g. `feat(scoring): …`).
- **Branch off the default branch** (`main`); never commit directly to `main`. Branch names: `feat/scoring-entry`, `fix/standings-tiebreak`.
- **Small, focused PRs.** One concern per PR. A PR description states what, why, and how to test; links the issue.
- **Commit lockfiles** (`yarn.lock`) and generated clients.
- PRs must be green (lint, typecheck, tests, build) and reviewed before merge. Don't commit/push unless asked.
- PR review checklist: reuse checked (§0)? scoped correctly (§17)? tests added? no secrets/PII? follows these guidelines?

---

## 17. File organization & shared-vs-local abstractions

**File organization:**
- Colocate by feature; keep files small and single-purpose. One component per file (plus tightly-coupled subcomponents).
- Import order: external → workspace (`@tournament/*`) → internal (`@/…`) → relative. Prettier + isort enforce ordering.
- Use the `@/` alias for web internal imports; avoid deep `../../..` chains.
- Barrels (`index.ts`) only for package public APIs (`packages/shared`), not inside apps.

**When to create a shared abstraction vs keep it local — the rule of three:**
1. **First use → keep it local.** Write it inline / in the feature. Don't pre-abstract.
2. **Second use → copy or lift one level**, only if the two uses are genuinely the same concept (not coincidentally similar).
3. **Third use → extract a shared abstraction** at the lowest tier that covers all consumers:
   - Used across features in web → `components/` or a shared hook.
   - Used across web + API (pure logic/types) → `packages/shared`.
   - Cross-cutting infra → `core/ports.py` + a factory.

**Guards against bad abstractions:**
- Prefer a little duplication over the wrong abstraction. Coupling two things that drift apart is worse than two copies.
- A shared abstraction must have a single clear responsibility and no `if mode === ...` branches serving different callers. If it sprouts flags per consumer, it's the wrong cut — split it.
- Sport logic is **never** shared into the engine/core — it lives in a Sport Profile. (Re-stating §1 because it's the most important boundary.)

---

## 18. Local development workflow

**Prerequisites:** Node ≥ 18.18 (`.nvmrc` pins 18.20.4), yarn 1.x, Python 3.13. Optional: Docker (local Postgres).

**Backend:**
```bash
cd apps/api
python3.13 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                       # runs without a DB; health/db reports "unavailable"
uvicorn app.main:app --reload --port 8000  # http://127.0.0.1:8000/api/v1/health
```

**Frontend:**
```bash
yarn install                               # from repo root (workspaces)
cp apps/web/.env.local.example apps/web/.env.local
yarn --cwd apps/web dev                     # http://localhost:3000
```

**Optional Postgres + migrations:**
```bash
docker compose up -d                       # Postgres on :5432
# set DATABASE_URL in apps/api/.env, then:
cd apps/api && alembic upgrade head
```

**Definition of done — all green before opening a PR:**
```bash
# Frontend (from repo root)
yarn --cwd apps/web typecheck && yarn --cwd apps/web lint && yarn --cwd apps/web build
yarn format:check

# Backend (from apps/api, venv active)
black --check app tests && isort --check-only app tests && flake8 app tests && mypy app && pytest
```

> Use `127.0.0.1` (not `localhost`) for the API URL locally — Node may resolve `localhost` to IPv6 `::1` while uvicorn binds IPv4.

---

*These guidelines evolve. Propose changes via PR. When a guideline and the code disagree, fix one of them — don't ignore the gap.*
