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

### Backend (`apps/api` — set in Railway/Render)
```
ENVIRONMENT=production
APP_BASE_URL=https://api.example.com          # used for share links + QR + cookie scheme
FRONTEND_URL=https://app.example.com
CORS_ORIGINS=https://app.example.com

# Database (Neon)
DATABASE_URL=postgresql+asyncpg://...         # pooled, for the app
DIRECT_URL=postgresql://...                   # direct, for Alembic migrations

# Auth / security (cookie-based JWT)
JWT_SECRET=...                                # signing key (rotate-able)
ACCESS_TOKEN_TTL=900                          # seconds (15 min)
REFRESH_TOKEN_TTL=2592000                     # seconds (30 days)
ADMIN_EMAIL=...                               # idempotent admin seed on startup
ADMIN_PASSWORD=...

# Object storage (Cloudflare R2 — S3-compatible)
S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_BUCKET=tournament-prod
S3_PUBLIC_BASE_URL=https://cdn.example.com    # public read host / image CDN

# Email (Resend)
RESEND_API_KEY=...
EMAIL_FROM="SIBL Badminton <noreply@example.com>"

# Observability
SENTRY_DSN=...

# --- Added only when scaling past one instance ---
# REDIS_URL=rediss://...                       # Upstash
# REALTIME_PROVIDER=ably|pusher                # managed realtime
# ABLY_API_KEY=... / PUSHER_APP_ID=... etc.
```

### Frontend (`apps/web` — set in Vercel)
```
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_APP_URL=https://app.example.com
NEXT_PUBLIC_SENTRY_DSN=...
```

## Deploy order

1. **Neon** — create project, copy `DATABASE_URL` + `DIRECT_URL`.
2. **Cloudflare R2** — create bucket, API token, optional public domain → S3 vars.
3. **Resend** — verify sending domain, create API key.
4. **Backend (Railway/Render)** — deploy `apps/api` container (`railway.toml`: bind `$PORT`, healthcheck `GET /api/v1/health`); set env; run Alembic migrations (`DIRECT_URL`); the in-process outbox/worker loop starts with the app.
5. **Vercel** — import `apps/web`; set `NEXT_PUBLIC_*`; deploy.
6. **DNS** — `app.*` → Vercel, `api.*` → Railway/Render, `cdn.*` → R2.
7. **Sentry + UptimeRobot** — wire DSNs; add keep-alive ping if on Render.

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
