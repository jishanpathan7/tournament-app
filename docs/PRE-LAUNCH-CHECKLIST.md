# Pre-Launch Checklist — playlane.live

> Run this checklist top-to-bottom before flipping DNS to production.
> Every item marked **CRITICAL** will cause a broken or insecure production deployment if skipped.

---

## 1. Railway — Backend environment variables

Set these in your Railway service's **Variables** tab before deploying.

### Required (CRITICAL — app will refuse to start without these)

| Variable | Example / Notes |
|---|---|
| `ENVIRONMENT` | `production` |
| `DATABASE_URL` | Neon **pooled** connection string (`postgresql+asyncpg://...`) |
| `DIRECT_URL` | Neon **direct** connection string (used by Alembic migrations) |
| `JWT_SECRET` | `openssl rand -hex 32` — at least 32 bytes |
| `STORAGE_SIGNING_SECRET` | `openssl rand -hex 32` — separate from `JWT_SECRET` |
| `COOKIE_SECURE` | `true` |
| `RESEND_API_KEY` | From [resend.com](https://resend.com) |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 API token (read + write) |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `R2_BUCKET` | Your R2 bucket name (e.g. `playlane-prod`) |
| `R2_PUBLIC_BASE_URL` | Public bucket URL (e.g. `https://assets.playlane.live`) |

### Strongly recommended

| Variable | Example / Notes |
|---|---|
| `CORS_ORIGINS` | `https://playlane.live` (comma-separated if multiple) |
| `FRONTEND_URL` | `https://playlane.live` |
| `APP_BASE_URL` | `https://api.playlane.live` (or Railway domain) |
| `EMAIL_FROM` | `Playlane <noreply@playlane.live>` |
| `COOKIE_DOMAIN` | `.playlane.live` (if API and frontend share root domain) |
| `SENTRY_DSN` | From your Sentry project (backend project, not the Next.js one) |
| `LOG_LEVEL` | `INFO` |

### Optional (defaults are safe)

| Variable | Default | Notes |
|---|---|---|
| `WORKER_ENABLED` | `true` | Set `false` to run a standalone worker instead |
| `GOOGLE_CLIENT_ID` | — | Only if Google OAuth is offered |
| `GOOGLE_CLIENT_SECRET` | — | Only if Google OAuth is offered |
| `GOOGLE_REDIRECT_URI` | — | Only if Google OAuth is offered |

---

## 2. Vercel — Frontend environment variables

Set these in your Vercel project's **Settings → Environment Variables** (scope: Production).

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://playlane.live` | Used for OG tags, share links, registration URLs |
| `NEXT_PUBLIC_API_URL` | *(leave empty)* | Empty = same-origin proxy (recommended) |
| `API_INTERNAL_URL` | Railway private URL or public URL | Used by Server Components to reach the API |
| `NEXT_PUBLIC_SENTRY_DSN` | From your Sentry Next.js project | Leave empty to disable Sentry |

> **Same-origin proxy**: Leave `NEXT_PUBLIC_API_URL` empty and ensure your Vercel domain
> (`playlane.live`) is in Railway's `CORS_ORIGINS`. The Next.js rewrite forwards `/api/v1/*`
> to `API_INTERNAL_URL`, keeping auth cookies on the same origin.

---

## 3. Domain & DNS (playlane.live)

- [ ] Point `playlane.live` → Vercel (add domain in Vercel Dashboard → Domains)
- [ ] Point `api.playlane.live` → Railway (optional; only needed if not using same-origin proxy)
- [ ] Point `assets.playlane.live` → Cloudflare R2 public bucket (custom domain in R2 settings)
- [ ] Verify SSL certificates are auto-provisioned on Vercel and Railway
- [ ] Set `HSTS` is active (already in `next.config.mjs` for production)

---

## 4. Email (Resend)

- [ ] Create a Resend account at [resend.com](https://resend.com)
- [ ] Add and verify the `playlane.live` domain in Resend (DNS TXT + MX records)
- [ ] Create an API key with **Send** permission only
- [ ] Set `RESEND_API_KEY` in Railway
- [ ] Set `EMAIL_FROM` to `Playlane <noreply@playlane.live>`
- [ ] Send a test registration email via the admin console to verify delivery

---

## 5. Sentry

- [ ] Create a **Next.js** project in Sentry → copy DSN to `NEXT_PUBLIC_SENTRY_DSN` in Vercel
- [ ] Create a **Python / FastAPI** project in Sentry → copy DSN to `SENTRY_DSN` in Railway
- [ ] Trigger a deliberate error in staging → verify it appears in Sentry Issues

---

## 6. Cloudflare R2

- [ ] Create bucket `playlane-prod`
- [ ] Create an R2 API token with read + write access to the bucket
- [ ] Enable public access on the bucket (or configure a custom domain)
- [ ] Set all R2 variables in Railway (see Section 1)
- [ ] Upload a test file via the admin console → verify the public URL resolves

---

## 7. Database (Neon)

- [ ] Create a Neon project (PostgreSQL 16)
- [ ] Copy the **pooled** connection string → `DATABASE_URL` in Railway
- [ ] Copy the **direct** (non-pooled) connection string → `DIRECT_URL` in Railway
- [ ] Run migrations: `alembic upgrade head` (Railway start command handles this via `uvicorn` lifecycle or run manually with `railway run alembic upgrade head`)
- [ ] Verify RLS is enforced: `GET /api/v1/health/ready` returns 200

---

## 8. Post-deploy smoke tests

Run these against `https://playlane.live` after deploying:

```bash
# Health checks
curl -f https://api.playlane.live/api/v1/health
curl -f https://api.playlane.live/api/v1/health/ready

# Public tournament search (should return 200 with empty array if no tournaments)
curl -f "https://playlane.live/api/v1/public/search?q=test"

# Auth flow
# 1. Register a new account via https://playlane.live/register
# 2. Verify the confirmation email arrives
# 3. Log in → confirm the console loads

# Rate limiting
# Hit /auth/register 6 times quickly → 6th should return HTTP 429
```

---

## 9. Pre-event checks (48h before SIBL)

- [ ] All player registrations imported / approved
- [ ] Draw published and visible on the public microsite
- [ ] Share links tested (scorekeeper invite, check-in QR)
- [ ] Court count correct in the draw
- [ ] Scoring role granted to scorekeepers via invite link
- [ ] Realtime SSE verified: open public page → score a match → standings update without refresh
- [ ] Mobile layout tested on iOS Safari + Android Chrome
- [ ] Rate-limiting tested on the public registration endpoint

---

## 10. Security final checklist

- [ ] `JWT_SECRET` is at least 32 random bytes (`openssl rand -hex 32`)
- [ ] `STORAGE_SIGNING_SECRET` is set and different from `JWT_SECRET`
- [ ] `COOKIE_SECURE=true` in Railway
- [ ] `CORS_ORIGINS` contains only `https://playlane.live` (no wildcards)
- [ ] No secrets in Git history (`git log --all -S "your-secret"` — should return nothing)
- [ ] Vercel and Railway dashboards locked down to team members only
- [ ] Neon project has IP allowlisting enabled (allowlist Railway's static IP or leave open for now)
