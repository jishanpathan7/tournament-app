# Production Launch Guide

> Status as of 2026-07-03. Target event: **SIBL Badminton — last week of July 2026.**

---

## TL;DR

The organizer workflows are production-ready. Two things are missing before you can
hand the app to participants directly: a **public self-registration page** and
**transactional emails for tournament events**. One code fix (Neon connection pooling)
must land before deploy. Infrastructure accounts still need to be provisioned.

**Time estimate to go live for SIBL (organizer-run, CSV import for registrations):**
~1 day of infra setup + the Neon fix. The event can run without the participant-facing
gaps if the organizer manages registrations via the import wizard.

---

## What is fully built and ready

| Area | What works |
|---|---|
| Auth | Register, login, email verify, password reset, org invites |
| Org / tournament management | Full CRUD, org roles, permissions |
| Registrations (organizer side) | Approve / reject / waitlist, capacity caps, admin table |
| CSV import | SurveyMonkey CSV → registration pipeline, column mapping, preview |
| Smart pairing | Skill-balanced doubles team formation (fold-pairing engine) |
| Draw generation | Round-robin, knockout, group+KO; draw gate; organizer override |
| Scoring + standings | Score entry, live standings, tie-break chain, result lock |
| Court & scheduling | Court CRUD, drag-and-drop timeline, conflict detection |
| Check-in / readiness | Attendance console (bulk + keyboard), readiness dashboard |
| Public microsite | `/t/[slug]` — bracket, standings, fixtures, live scores, participants |
| Notifications infrastructure | DB model, in-app delivery, email dispatch queue, outbox worker |
| Schedule / scoring notifications | `notify()` called on match scheduled, rescheduled, scored, advanced |
| Email templates (auth flows) | `verify_email`, `password_reset`, `org_invite` |

---

## Gaps that block a good participant experience

### 1. No public self-registration UI

The backend registration endpoints exist. There is no `/t/[slug]/register` page where
a participant can fill out a form and submit their own registration. For SIBL you can
work around this with CSV import — the organizer imports the SurveyMonkey export.
Build this page before opening registration to participants directly.

### 2. No transactional emails for tournament events

The email infrastructure is fully wired (Resend channel, Jinja2 renderer, outbox
worker, dispatch handler). What is missing are the **notification templates and the
`notify()` calls** in the registrations module:

- No "registration received / confirmed" email to participant
- No "registration approved or rejected" email
- No "draw has been published" email
- No "your next match is on court 3 in 15 minutes" push

> **Note:** scheduling and scoring already call `notify()` — those events **will**
> deliver emails as soon as `RESEND_API_KEY` is set. Only the registration flow is
> missing.

### 3. No participant portal

`/portal` exists as a route group but has only a placeholder page. Authenticated
participants cannot view their own schedule, draw position, or match history.

---

## The one code fix required before deploying

**`apps/api/app/core/db.py` — add `statement_cache_size: 0` to asyncpg connect args.**

Neon's pooled endpoint fronts Postgres with PgBouncer in **transaction** mode. asyncpg
auto-prepares statements, which collide across pooled backends and cause intermittent
`prepared statement does not exist` errors under concurrent load. This is a one-line fix.

```python
# apps/api/app/core/db.py  (line ~27 in _init())

# BEFORE
_engine = create_async_engine(settings.database_url, future=True, pool_pre_ping=True)

# AFTER
_engine = create_async_engine(
    settings.database_url,
    future=True,
    pool_pre_ping=True,
    connect_args={"statement_cache_size": 0},
)
```

> Alembic migrations must always run against the **direct** Neon URL (not the pooled
> one), because DDL transactions cannot tolerate PgBouncer transaction-mode pooling.
> Use `DIRECT_URL` for the migration command; `DATABASE_URL` for the running app.

---

## Infrastructure accounts to create

All services have a free tier sufficient for the SIBL event. Every service speaks a
standard protocol — upgrading is a credentials swap, not a code change.

| Service | Purpose | Free tier | URL |
|---|---|---|---|
| **Neon** | PostgreSQL database | 0.5 GB, scales to zero, branching | neon.tech |
| **Railway** *(recommended)* | FastAPI host + in-process worker | ~$5/mo Hobby, no spin-down | railway.app |
| **Render** *(alternative)* | FastAPI host | Free, but cold-starts ~30–60 s — breaks live SSE | render.com |
| **Vercel** | Next.js frontend | Free Hobby (non-commercial use) | vercel.com |
| **Cloudflare R2** | File storage — logos, exports | 10 GB, zero egress cost | cloudflare.com |
| **Resend** | Transactional email | 3,000/mo, 100/day | resend.com |
| **Sentry** | Error tracking | 5,000 errors/mo | sentry.io |
| **UptimeRobot** | Keep-alive ping *(Render only)* | Free | uptimerobot.com |

> **Railway vs Render:** Render's free tier cold-starts after ~15 min idle and drops
> SSE connections — which breaks live scoring mid-match. Use Railway Hobby ($5/mo)
> on event days, or keep an UptimeRobot ping every 10 min if staying on Render.

---

## Deploy order

Run these steps in sequence. Later steps depend on credentials from earlier ones.

```
1. Neon
   → Create project (Postgres 16)
   → Copy the pooled DATABASE_URL and the direct DIRECT_URL

2. Cloudflare R2
   → Create bucket: tournament-prod
   → Create API token with Object Read & Write on that bucket
   → (Optional) add a custom domain for public reads → R2_PUBLIC_BASE_URL

3. Resend
   → Add and verify your sending domain (DNS TXT + MX records)
   → Create an API key with Sending access
   → Note: emails go to logs until this key is set — nothing breaks

4. Railway (backend)
   → New project → Deploy from GitHub → select apps/api
   → Set all backend env vars (see section below)
   → One-off command: alembic upgrade head  (uses DIRECT_URL)
   → Confirm health: GET https://api.yourdomain.com/api/v1/health → {"status":"ok","db":"ok"}

5. Vercel (frontend)
   → Import repo → set Root Directory to apps/web
   → Set NEXT_PUBLIC_API_URL and NEXT_PUBLIC_SENTRY_DSN
   → Deploy

6. DNS
   → app.yourdomain.com  → Vercel
   → api.yourdomain.com  → Railway
   → cdn.yourdomain.com  → Cloudflare R2 (if using custom domain)

7. Sentry
   → Create two projects: one Python (backend), one JavaScript (frontend)
   → Paste DSNs into env vars

8. UptimeRobot (Render only)
   → Add HTTP monitor: GET https://api.yourdomain.com/api/v1/health every 10 min
```

---

## Environment variables

### Backend — set in Railway (or Render)

```bash
# ── Runtime ───────────────────────────────────────────────────────────────────
ENVIRONMENT=production
APP_BASE_URL=https://api.yourdomain.com
FRONTEND_URL=https://app.yourdomain.com
CORS_ORIGINS=https://app.yourdomain.com
LOG_LEVEL=INFO

# ── Database (Neon) ───────────────────────────────────────────────────────────
# Pooled URL — used by the running application
DATABASE_URL=postgresql+asyncpg://user:pass@ep-xxx.pooler.neon.tech/tournament?sslmode=require

# Direct URL — used only for Alembic migrations (never by the app)
# Run: alembic -x url=$DIRECT_URL upgrade head
DIRECT_URL=postgresql://user:pass@ep-xxx.neon.tech/tournament?sslmode=require

# ── Auth ──────────────────────────────────────────────────────────────────────
# Generate: python3 -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET=<32-byte-random-hex>
ACCESS_TOKEN_TTL=900          # 15 min
REFRESH_TOKEN_TTL=2592000     # 30 days
EMAIL_VERIFICATION_TOKEN_TTL=86400
PASSWORD_RESET_TOKEN_TTL=3600

# ── Cookies ───────────────────────────────────────────────────────────────────
COOKIE_SECURE=true            # MUST be true — enforced by startup validator
COOKIE_SAMESITE=lax
COOKIE_DOMAIN=.yourdomain.com # allows api.* and app.* to share auth cookies

# ── Email (Resend) ────────────────────────────────────────────────────────────
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=SIBL Badminton <noreply@yourdomain.com>

# ── Object storage (Cloudflare R2) ────────────────────────────────────────────
R2_ACCOUNT_ID=xxxxxxxxxxxxxxxxxxxx
R2_ACCESS_KEY_ID=xxxxxxxxxxxxxxxxxxxx
R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxx
R2_BUCKET=tournament-prod
R2_ENDPOINT_URL=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_PUBLIC_BASE_URL=https://cdn.yourdomain.com

# ── Observability ─────────────────────────────────────────────────────────────
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# ── Worker (in-process at MVP — leave enabled) ────────────────────────────────
WORKER_ENABLED=true
WORKER_POLL_INTERVAL=2.0
```

### Frontend — set in Vercel

```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

---

## Running database migrations on Neon

Neon requires the **direct** (non-pooled) connection for DDL. Railway lets you run
one-off commands in the same container:

```bash
# In Railway → your service → Settings → Deploy → Start Command (one-off)
python -m alembic upgrade head
```

Or set a `DIRECT_URL` env var and run from your local machine pointed at production:

```bash
cd apps/api
DATABASE_URL=$DIRECT_URL .venv/bin/python -m alembic upgrade head
```

---

## First organizer account

There is no admin seed script yet. Create the first account through the normal sign-up
flow after deploy:

```
1. Open https://app.yourdomain.com/register
2. Create an account with your organizer email
3. Verify the email (check Resend logs or your inbox)
4. Create an organisation → you are the owner
5. Create a tournament
```

---

## Smoke test checklist after deploy

Run these in order to confirm every layer is working:

```
□  GET  https://api.yourdomain.com/api/v1/health
       → {"status":"ok","db":"ok","environment":"production"}

□  Open https://app.yourdomain.com
       → Console shell loads, no network errors in DevTools

□  Register a new user account
       → Verification email arrives via Resend

□  Create an organisation and tournament
       → Appears in the console dashboard

□  Upload a logo
       → Stored in R2, loads from cdn.yourdomain.com

□  Create a division, add two participants, generate a draw
       → Bracket visible in console and at /t/[slug]/bracket

□  Open the public microsite /t/[slug]
       → Loads without authentication, bracket visible

□  Assign a match to a court and time
       → Match-called notification delivered (check Resend dashboard)

□  Score a match
       → Standings update live on the public microsite
```

---

## Upgrade triggers (when free stops being enough)

None of these require code changes — only env var swaps and factory wiring.

| Signal | Action |
|---|---|
| Render cold-starts disrupting SSE | Move to Railway Hobby (~$5/mo) |
| Second backend instance needed | Add **Upstash Redis** → set `REDIS_URL`; flip `PubSub`/`JobQueue`/`Cache` to Redis impls |
| Concurrent public viewers spike | Move realtime to Ably or Pusher free tier → paid |
| DB exceeds free storage | Upgrade to Neon paid tier |
| Commercial / external-org use | Upgrade to **Vercel Pro** ($20/mo — Hobby is non-commercial) |
| Email volume exceeds free | Upgrade Resend plan |

---

## Readiness summary

| Capability | SIBL event (organizer-run) | Open participant self-service |
|---|---|---|
| Run the full tournament | ✅ Ready | ✅ Ready |
| Register participants via CSV import | ✅ Ready | ✅ Ready |
| Participant self-registration (web form) | ⚠️ Workaround via CSV | ❌ Page not built |
| Registration confirmation email | ❌ Template not wired | ❌ Template not wired |
| Schedule / result notifications | ✅ Wired (needs `RESEND_API_KEY`) | ✅ Wired (needs `RESEND_API_KEY`) |
| Participant portal (own schedule/results) | ❌ Not built | ❌ Not built |
| Neon pooling fix | ⚠️ One-line fix required | ⚠️ One-line fix required |
| Infrastructure provisioned | ❌ Accounts not created yet | ❌ Accounts not created yet |

**Recommended path to SIBL launch:**
1. Apply the Neon `statement_cache_size` fix (10 min)
2. Provision Neon → Railway → Vercel → R2 → Resend → Sentry (1 day)
3. Run migrations, smoke test, create organizer account
4. Import registrations via SurveyMonkey CSV export on event day

**Next features to build (in priority order for the event):**
1. Public self-registration page — `/t/[slug]/register`
2. Registration notification emails — templates + `notify()` calls in registrations module
3. Participant portal — authenticated view of own schedule and results
