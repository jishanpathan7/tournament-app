# Deployment — free-tier MVP

How to run the platform in production for ~zero cost, and upgrade in place as users arrive. Companion to `Technical-Architecture.md` §15.

> Principle: pick services we **upgrade, never migrate**. Everything speaks a standard protocol (Postgres wire, S3 API, SMTP/HTTP email), so going paid is a credentials change.

## Target topology (MVP)

```
Vercel (Next.js web)  ──HTTPS──>  Railway/Render (FastAPI api + worker)
                                        ├── Neon (PostgreSQL)
                                        ├── Cloudflare R2 (object storage, S3 API)
                                        └── Resend (transactional email)
   (no Redis at MVP — single instance handles pub/sub, jobs, cache in-process)
```

## Accounts to create (all have free tiers)

| Service | Used for | Free tier (verify — limits drift) |
|---|---|---|
| **Vercel** | Frontend hosting | Hobby (non-commercial) |
| **Railway** *(recommended)* or **Render** | Backend API + worker | Railway ~$5/mo, no spin-down · Render free, spins down ~15 min idle |
| **Neon** | PostgreSQL | ~0.5 GB, scales to zero, branching |
| **Cloudflare R2** | File storage | ~10 GB, zero egress |
| **Resend** | Email | ~3,000/mo, 100/day |
| **Sentry** | Error tracking | ~5k errors/mo |
| **UptimeRobot** | Keep-alive ping (if on Render) | free |

## Why Railway over Render for the first event

Render's free web service cold-starts (~30–60s) and drops idle WebSocket/SSE connections — which breaks **live scoring** mid-tournament. Either spend ~$5/mo on Railway Hobby (no spin-down), or stay on Render and run an UptimeRobot ping every ~10 min on event days.

## Environment variables

### Backend (`apps/api` — set in Railway)
```
ENVIRONMENT=production
APP_BASE_URL=https://app.example.com          # public frontend URL (used in share links + emails)
FRONTEND_URL=https://app.example.com
CORS_ORIGINS=https://app.example.com

# Database (Neon)
DATABASE_URL=postgresql+asyncpg://...         # pooled endpoint — used by the app at runtime
DIRECT_URL=postgresql+asyncpg://...           # direct (non-pooled) endpoint — used by Alembic migrations
                                              # Run migrations as: alembic upgrade head
                                              # (migrations/env.py reads DIRECT_URL automatically)

# Auth / security (cookie-based JWT)
JWT_SECRET=...                                # 32+ byte random secret: openssl rand -hex 32
STORAGE_SIGNING_SECRET=...                    # separate 32+ byte secret for presigned storage URLs
COOKIE_SECURE=true
ACCESS_TOKEN_TTL=900                          # seconds (15 min)
REFRESH_TOKEN_TTL=2592000                     # seconds (30 days)

# Object storage (Cloudflare R2)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=playlane-prod
R2_PUBLIC_BASE_URL=https://cdn.example.com    # public bucket URL or custom CDN domain

# Email (Resend)
RESEND_API_KEY=...
EMAIL_FROM="Playlane <noreply@example.com>"

# Workers (set false on API replicas if running more than one instance)
WORKER_ENABLED=true

# Observability
SENTRY_DSN=...

# ── Added only when scaling past one instance ──────────────────────────────
# REDIS_URL=rediss://...                       # Upstash — enables distributed throttle/pubsub/cache
```

### Frontend (`apps/web` — set in Vercel)

The recommended pattern is **same-origin proxy**: the Vercel frontend proxies
`/api/v1/*` to the Railway backend via Next.js rewrites. This means auth cookies
work at the same origin with no `COOKIE_DOMAIN` or CORS complexity.

```
# Leave empty — frontend uses same-origin /api/v1 proxy (next.config.mjs rewrite)
NEXT_PUBLIC_API_URL=

# Internal Railway URL for Server Components / SSR to reach the API directly.
# Use Railway's private networking URL (e.g. https://api.railway.internal).
API_INTERNAL_URL=https://your-service.railway.internal

# Public app URL — used for OG metadata, share links, tournament registration URLs.
NEXT_PUBLIC_APP_URL=https://app.example.com

# Frontend error tracking
NEXT_PUBLIC_SENTRY_DSN=...
```

## Deploy order

1. **Neon** — create project, copy the pooled URL as `DATABASE_URL` and the direct URL as `DIRECT_URL`.
2. **Cloudflare R2** — create bucket, generate API token (`Object Read & Write`), optional public domain → set `R2_*` vars.
3. **Resend** — verify sending domain (SPF/DKIM/DMARC), create API key.
4. **Backend (Railway)** — deploy `apps/api` (nixpacks auto-detects Python); set all env vars from the table above; run migrations once: `alembic upgrade head` (reads `DIRECT_URL`); the in-process outbox/worker loop starts automatically with the app.
5. **Vercel** — import `apps/web`; set `API_INTERNAL_URL` to Railway's private URL, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SENTRY_DSN`; leave `NEXT_PUBLIC_API_URL` empty.
6. **DNS** — `app.*` → Vercel; `cdn.*` → R2 public bucket (no separate `api.*` needed with same-origin proxy).
7. **Sentry + UptimeRobot** — wire DSNs; add keep-alive ping if on Render (Railway Hobby has no spin-down).

## Database connection & RLS notes (read before going live)

The data layer uses Postgres **Row-Level Security** (FORCE'd) scoped by a per-transaction
GUC (`SET LOCAL app.current_org`). Three deployment requirements follow:

- **PostgreSQL 15+ required.** The `standings` uniqueness uses `NULLS NOT DISTINCT`. Neon
  is 15/16 (fine); the initial migration hard-fails on older servers with a clear error.
- **Pooled endpoint + asyncpg.** Neon's pooled `DATABASE_URL` fronts Postgres with PgBouncer
  in **transaction** mode. asyncpg auto-prepares statements, which collide across pooled
  backends → intermittent `prepared statement does not exist` / `cached plan` errors under
  load. Fix at wire-up time (engine `connect_args={"statement_cache_size": 0}`, plus a unique
  `prepared_statement_name_func`), **or** point the app at Neon's **direct** endpoint and pool
  in-process. Migrations always use `DIRECT_URL`. (Deliberately not hardcoded in `core/db.py`
  yet — it would slow direct-connection dev/CI; decide it with the deploy topology.)
- **RLS correctness under pooling.** `SET LOCAL` is transaction-scoped, so it is safe under
  transaction pooling **only if** every org-scoped query runs inside the same transaction that
  set the context. The auth layer must set `app.current_org` at the start of each request's
  transaction (helper: `app/db/session.py:set_org_context` / `org_scope`). With FORCE on, a
  query with no context returns **zero rows** — connect the app as a **non-superuser** role
  (Neon's default role is non-superuser, so FORCE applies; never run the app as a superuser).

## Upgrade triggers (when free stops being enough)

| Signal | Action |
|---|---|
| Live event needs reliable realtime | Railway Hobby / Render Starter (no spin-down) |
| Second backend instance required | Add **Upstash Redis** → set `REDIS_URL`; flip `PubSub`/`JobQueue`/`Cache` to Redis impls (see `INTERFACES.md`) |
| Concurrent public viewers spike | Move realtime to **Ably/Pusher** free → paid |
| DB exceeds free storage / steady load | Neon paid tier |
| External / commercial users | **Vercel Pro** ($20/mo — Hobby is non-commercial) |
| Email volume > free | Resend paid |

None of these change application code — they change env vars and which interface implementation is wired in.
