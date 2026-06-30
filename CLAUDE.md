# CLAUDE.md — project context

> Auto-loaded context for Claude Code sessions. Keep it short, current, and link out to the canonical docs rather than duplicating them.

## What this is

A **multi-sport Tournament Management Platform** (SaaS). First real use case: an internal **SIBL badminton tournament** (target: last week of July 2026). The platform must run *that* event while being architected so any sport (cricket, football, table tennis, chess, hackathons, esports) is added later **without schema or engine changes**.

## Current status (as of 2026-06)

- ✅ Product architecture — `Platform-Product-Spec.md`
- ✅ Technical architecture — `Technical-Architecture.md`
- ✅ Hosting / free-tier plan — `Technical-Architecture.md` §15 + `docs/DEPLOYMENT.md`
- ✅ UI/UX design system — `docs/DESIGN-SYSTEM.md` (+ mockups)
- ✅ **Dev foundation is live.** Monorepo runs: `apps/web` (Next 15) + `apps/api` (FastAPI) install, lint, type-check, test, build, and communicate locally. Engineering standards in `ENGINEERING_GUIDELINES.md`.
- 🟦 **Next: build features** on this baseline — follow `ENGINEERING_GUIDELINES.md` (reuse-first; check existing components/hooks/utils/services before adding new).

## The one rule that governs every decision

**Sport-agnostic core.** Three layers stay separate; never leak sport logic into the core:
1. **Format Engine** (`apps/api/app/engine/`) — round robin / knockout / group+KO / swiss / ladder. Knows nothing about sports.
2. **Sport Profile** (`apps/api/app/sports/`) — participant type, result schema, win/draw rules, tie-break ruleset. Pluggable.
3. **Domain Core** — `Organization → Tournament → Division → Stage → Group/Round → Match → Standing`. Delegates to the two above.

A `Match` stores a generic JSON `result_payload` validated by its Sport Profile. The engine only sees the abstract outcome (`winner | draw | ranked[]`). **Adding a sport = a new file in `sports/`, not a migration.** If you ever write `if sport == "badminton"`, stop.

## Tech stack

> **Pinned versions + the full kept/dropped list live in `docs/STACK.md`.** Manifests are the source of truth: `apps/api/requirements.txt`, `apps/web/package.json`.

- **Frontend:** Next.js 15 (App Router, RSC) · React 19 · TypeScript · Tailwind 3.4 · shadcn/ui → **Vercel**. Libraries: TanStack Query, axios (`withCredentials`), react-hook-form + zod, lucide-react, sonner, framer-motion, recharts, qrcode.react.
- **Backend:** Python **FastAPI** (async) · SQLAlchemy 2.0 + asyncpg · Alembic · Pydantic v2 → **Railway** (primary) or Render.
- **Data:** PostgreSQL (**Neon** free tier) · object storage (**Cloudflare R2** via boto3/S3 API) · email (**Resend**).
- **Auth:** cookie-based JWT (HTTP-only; `secure`/`samesite` from URL scheme). No bearer tokens in JS.
- **Package manager:** **yarn** (workspaces; `yarn.lock` only — never `package-lock.json`).
- **Redis:** *not used at MVP* — single instance does pub/sub, jobs, and cache in-process. Added (**Upstash**) only when scaling to a 2nd instance. See `docs/INTERFACES.md`.
- **Contracts:** FastAPI OpenAPI → **generated** TS client in `packages/api-client`. Never hand-write the client; never let it drift.
- **Not at MVP:** payments (Polar/Stripe), 2FA/SSO, MongoDB, CRA/CRACO, Puppeteer prerender — see `docs/STACK.md` for the full dropped list.

## Multi-tenancy (non-negotiable)

`organization_id` on every tenant row, enforced at three layers: app query scoping → policy layer → Postgres **Row-Level Security**. Public plane only ever serves `visibility != private` + published artifacts, and never PII.

## Repo layout

```
apps/web      Next.js frontend (3 surfaces: console, portal, public microsite)
apps/api      FastAPI backend + engine/ (formats) + sports/ (profiles) + workers
packages/     api-client (generated), ui (shadcn), config, shared
docs/         deployment, interface contracts, doc index
```
Each top-level folder has its own `README.md`. Backend modules are vertical slices: `router · service · repository · schemas · events`.

## Conventions

- **TS:** strict mode, no `any`; forms validated with Zod; data fetching via the generated client.
- **Python:** async everywhere; `engine/` and `sports/` have **zero framework imports** (pure, unit-testable).
- **Infra is swappable behind interfaces** (`PubSub`, `JobQueue`, `Cache`, `Storage`, `EmailChannel`, `AuthService`) — see `docs/INTERFACES.md`. Free→paid is a config swap, not a refactor.
- **Naming/casing:** snake_case (Python/DB), camelCase (TS), kebab-case (routes/files in web).
- **API shape:** all routes under `APIRouter(prefix="/api/v1")`; mount CORS *after* routers. String UUID ids on every row (never leak sequence ids). PATCH uses `clear_<field>: true` flags — never overload `null` to mean "clear".
- **Frontend env:** single `NEXT_PUBLIC_API_URL`; client appends `/api/v1`. `@/` alias → `src/`.
- **Commits:** Conventional Commits. Branch off the default branch; don't commit/push unless asked.

## Canonical docs (read before large changes)

| Doc | Purpose |
|---|---|
| `Platform-Product-Spec.md` | Vision, personas, flows, features, data model, MVP, roadmap |
| `Technical-Architecture.md` | Folder structure, API, schema, auth/z, realtime, sharing, uploads, notifications, QR, hosting |
| `docs/STACK.md` | Pinned stack + what we kept/dropped from the blueprint and why |
| `docs/DESIGN-SYSTEM.md` | UI/UX design system ("Candy Sticker" theme) + themed mockups in `docs/mockups/` |
| `ENGINEERING_GUIDELINES.md` | **Engineering standards for all new code (read before building).** Reuse-first rule, architecture, conventions, testing, security, git/PR, dev workflow |
| `docs/DEPLOYMENT.md` | Free-tier deploy steps, env vars, upgrade triggers |
| `docs/INTERFACES.md` | Swappable infra contracts (the free→paid seam) |
| `Tournament-Playbook.md` | The badminton event's organizing rules + fairness engine |
| `SIBL-Badminton-2026-Workbook.xlsx` | Live templates for running the July event |

## Notes for future sessions

- A persistent memory index lives outside the repo (loaded automatically). The product/architecture decisions and *why* are captured there too.
- When in doubt about a feature, check the product spec; about a mechanism, the tech architecture; about "can I afford it," the deployment doc.
