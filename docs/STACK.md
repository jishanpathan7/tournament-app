# Pinned tech stack (MVP)

The canonical record of what we use and why. Reconciles the **"FastAPI + React SPA" blueprint** the team standardizes on with this product's needs. Decisions confirmed 2026-06.

> Two load-bearing choices were settled explicitly: **PostgreSQL (not MongoDB)** and **Next.js 15 (not a CRA SPA)**. From the blueprint we kept the component libraries, cookie-auth model, and conventions; we dropped what only made sense for a Mongo-backed CRA SPA.

## Decisions at a glance

| Area | Choice | vs blueprint |
|---|---|---|
| Database | **PostgreSQL / Neon** (SQLAlchemy 2.0 + asyncpg + Alembic) | Diverged — blueprint used MongoDB/Motor |
| Frontend shell | **Next.js 15** (App Router, RSC) | Diverged — blueprint used CRA + CRACO SPA |
| Package manager | **yarn** (workspaces; `yarn.lock`, never `package-lock.json`) | Kept blueprint's yarn pin |
| Auth | **Cookie-based JWT** (HTTP-only; `secure`/`samesite` from URL scheme) | Kept blueprint's model |
| Payments | **None at MVP** | Dropped Polar/Stripe for now |
| Realtime / jobs | In-process SSE/WS + outbox poller (no Redis at MVP) | Added — blueprint had neither |

## Backend — kept (pins in `apps/api/requirements.txt`)

FastAPI `0.136.3` · Uvicorn `0.48.0` · Pydantic v2 `>=2.13.4` · email-validator · python-multipart · **SQLAlchemy[asyncio] 2.0 + asyncpg + Alembic** (Postgres) · PyJWT · passlib[bcrypt] + bcrypt `5.0.0` · cryptography · **boto3** (R2 via S3 API) · **resend** (email) · httpx · **sse-starlette** (live scoring) · sentry-sdk[fastapi] · python-json-logger · python-dotenv · typer · tzdata · pytest/black/isort/flake8/mypy.

## Frontend — kept (pins in `apps/web/package.json`)

Next.js 15 · React 19 · TypeScript · TailwindCSS `3.4` + autoprefixer/postcss · shadcn/ui (+ Radix primitives, added per-component) · **@tanstack/react-query** `5` (+ devtools) · **axios** (`withCredentials: true`) · **react-hook-form** `7` + **zod** `4` + @hookform/resolvers · **lucide-react** · **sonner** (toasts) · **framer-motion** · **recharts** (standings/charts) · **qrcode.react** (QR rendering) · clsx + tailwind-merge + class-variance-authority + tailwindcss-animate · date-fns · cmdk · vaul · react-day-picker · input-otp · **@sentry/nextjs** · @vercel/analytics · ESLint 9 + Prettier + prettier-plugin-tailwindcss.

## Dropped from the blueprint (and why)

| Dropped | Reason |
|---|---|
| Motor, PyMongo | Using PostgreSQL, not MongoDB |
| polar-sdk (payments) | No billing at MVP — add later behind a payments interface (`docs/INTERFACES.md`) |
| pyotp (2FA), requests-oauthlib (SSO/OAuth) | First-party email auth + magic links only at MVP; 2FA/SSO are post-MVP |
| geoip2, beautifulsoup4 | No geo lookup or OG scraping needed (Next handles OG/SEO) |
| pandas, numpy, jq | Standings math is simple SQL/Python; no heavy data tooling |
| python-jose, requests | Deduplicated — PyJWT for tokens, httpx as the one HTTP client |
| react-router-dom | Next.js App Router handles routing |
| react-scripts (CRA), @craco/craco, esbuild | Next.js is the toolchain |
| Puppeteer, @sparticuz/chromium, react-helmet-async | Next ISR/SSR + Metadata API replace prerendering for SEO |
| next-themes | No dark mode at MVP (trivial to add later) |
| posthog-js, DataFast | Product analytics deferred; @vercel/analytics kept (free). Add PostHog later if needed |

## Conventions carried over from the blueprint

- **All API routes under one prefix** — `APIRouter(prefix="/api/v1")`; add CORS **after** mounting routers.
- **Cookie auth** — `set_auth_cookies` derives `secure`/`samesite` from the base-URL scheme (HTTP dev → `lax`/insecure; HTTPS prod → `none`/secure). No bearer tokens in JS.
- **String UUID ids** on every row (UUIDv7); never leak internal sequence ids.
- **PATCH semantics** — never overload `null` to mean "clear"; use paired `clear_<field>: true` flags.
- **Frontend env** — single `NEXT_PUBLIC_API_URL`; the client appends `/api/v1`. `@/` alias → `src/`.
- **Idempotent admin seed** on startup (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).
- **Plan gating** (when payments land) — paid features return **402** for free tiers; tiers rank-checked.

## Diverged from the blueprint (and why)

- **PostgreSQL over MongoDB** — tournament data is deeply relational (standings derived from matches, knockout advancement, FK integrity) and multi-tenancy uses Postgres **Row-Level Security** as a backstop. JSONB still gives schemaless flexibility for sport `result_payload`.
- **Next.js over CRA SPA** — the public microsite needs ISR/SSR/SEO natively; avoids the Puppeteer prerender step. The blueprint's component libraries are framework-agnostic and adopted as-is.
- **yarn *workspaces* + Turborepo** — honors the blueprint's yarn pin while supporting our monorepo (`apps/*`, `packages/*`).
- **Added realtime + background jobs** — the blueprint has neither; live scoring needs SSE/WS, reliability needs the outbox poller. Both run in-process at MVP (no Redis) per `docs/INTERFACES.md`.

> Manifests are the source of truth for versions: `apps/api/requirements.txt` and `apps/web/package.json`. Update those, then this file's prose if a decision changes.
