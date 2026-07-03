# SIBL Badminton 2026 — App Readiness Report

> Generated: 2026-07-03. Target event: last week of July 2026.

This document captures the current state of the tournament platform specifically for the SIBL badminton event, what's built, what's missing, and the key findings from our assessment sessions.

---

## 1. What is fully built and working

| Feature | Status | Notes |
|---|---|---|
| Auth (register, login, verify, password reset, org invites) | ✅ Complete | Cookie-based JWT, HTTP-only |
| Org + Tournament + Division CRUD | ✅ Complete | Full organizer console |
| Registrations (organizer-side approve / reject / waitlist) | ✅ Complete | Capacity caps, admin table |
| SurveyMonkey CSV import | ✅ Complete | Column mapping, preview, commit pipeline |
| Attendance check-in console | ✅ Complete | Bulk + keyboard shortcut check-in |
| Readiness dashboard + draw gate | ✅ Complete | Blocks draw until attendance threshold met; organizer override |
| Smart pairing engine (FoldPairingEngine) | ✅ Complete | Skill-balanced doubles pair formation; honors pre-formed pairs |
| Draw generation | ✅ Complete | Round-robin, knockout, group+KO; organizer-controlled |
| Scoring + standings | ✅ Complete | Score entry, live standings, full tie-break chain, result lock |
| Court management | ✅ Complete | Court CRUD, drag-and-drop schedule timeline, conflict detection |
| Match scheduling | ✅ Complete | Assign matches to courts + time slots |
| Public microsite (`/t/[slug]`) | ✅ Complete | Bracket, standings, fixtures, live scores — no login required |
| Notifications infrastructure | ✅ Complete | DB model, in-app delivery, email dispatch queue, outbox worker |
| Schedule / scoring notifications | ✅ Complete | `notify()` fires on match assigned, rescheduled, scored, advanced |
| Auth email templates | ✅ Complete | `verify_email`, `password_reset`, `org_invite` |

---

## 2. What is missing for the SIBL event

### 2a. Missing for a smooth participant experience

| Gap | Impact | Workaround for July event |
|---|---|---|
| **Public self-registration page** (`/t/[slug]/register`) | Participants can't register themselves via the web | Import registrations via SurveyMonkey CSV export — fully built |
| **Registration notification emails** | No "registration received / confirmed" email to participant | Manual comms via company channels |
| **Registration approved / rejected emails** | Participant doesn't know their status automatically | Manual comms |
| **Draw published notification** | No email when bracket goes live | Post in company channel |
| **Participant portal** (`/portal`) | Authenticated participants can't view their own schedule, draw position, match history | Direct them to the public microsite |
| **Notification bell UI** | In-app notification inbox exists in DB but no frontend UI | — |

### 2b. Missing for organizer / operational flow

| Gap | Impact | Workaround |
|---|---|---|
| **Umpire / scorekeeper role** | No dedicated umpire account type; scores entered by organizer | Organizer enters scores post-match from signed paper score sheets |
| **Mobile live scorekeeper** | `docs/mockups/scorekeeper-mobile.html` mockup exists — NOT built. No tap-per-point live scoring | Paper score sheets; organizer enters final scores |
| **Pre-formed pair import** | CSV import can't import a "partner name" column to auto-honor declared pairs | Organizer manually assigns pre-formed pairs in the pairing review UI after import |
| **QR code check-in** | Players can't scan a QR to self-check-in | Manual check-in via the attendance console |

### 2c. One required code fix before production deploy

**`apps/api/app/core/db.py` — Neon connection pooling.**

Neon uses PgBouncer in transaction mode. asyncpg auto-prepares statements, causing `prepared statement does not exist` errors under concurrent load. Fix is one line:

```python
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

> Alembic migrations must always use the **direct** Neon URL (not the pooled one). Use `DIRECT_URL` for migrations; `DATABASE_URL` for the running app.

---

## 3. The franchise-team format — key finding

### What the user described

The SIBL event runs in a **franchise-team / squad format**:
1. All participants register (via SurveyMonkey)
2. Four captains are assigned (one per team)
3. All participants are distributed across the 4 teams, balanced by skill
4. Matches are **team vs team** — multiple doubles games between the two squads; the team that wins more games wins the "tie"
5. A final round determines the overall team winner and runner-up

### What the app's data model currently represents

The app's `Team` entity = **a doubles pair (2 players)**. This is not a franchise team. The system operates entirely at the individual pair level:

- Registration unit → individual or doubles pair
- Pairing engine → forms balanced pairs (2 players each)
- Draw → pairs vs pairs
- Standings → pair-level wins/losses

### The gap

| Franchise-team concept | App support |
|---|---|
| Captain designation / role | ❌ Not built |
| Squad / franchise team model (N doubles pairs under one banner) | ❌ Not built |
| Skill-balanced player distribution across 4 squads (snake draft) | ❌ Not built |
| Team-vs-team match container (a "tie" = N doubles games, aggregate winner) | ❌ Not built |
| Team standings (win/loss at squad level) | ❌ Not built |

### What would be required to build this

1. **New `Squad` model** — name, captain FK, tournament FK; a squad owns many doubles pairs
2. **Squad distribution algorithm** — snake-distribute all players across 4 squads by skill weight so each squad has an even spread (A→B→C→D→D→C→B→A)
3. **Team-tie match container** — a "tie" groups N doubles games between two squads; tie winner = squad with more game wins
4. **Team standings** — wins/losses at squad level, qualifying logic for finals
5. **Frontend views** — squad management, team draw, team standings tables

Rough estimate: **2–3 weeks** of feature work (new DB models + migration, engine extension, backend module, frontend views, tests).

### Practical options for SIBL July 2026

| Option | Effort | What you give up |
|---|---|---|
| **A — Standard doubles draw** (what the app does today) | Zero | No franchise-team concept; champion is a pair, not a team |
| **B — App for operations + Workbook for team tracking** | Low | Team standings and team-tie scoring stay in Google Sheets; app handles scheduling, scoring, and display |
| **C — Build franchise-team feature before July** | High (2–3 weeks) | Tight timeline; July is 3 weeks away |

**Recommended for July 2026: Option B.** The Tournament Playbook and the companion `SIBL-Badminton-2026-Workbook.xlsx` already handle the franchise-team layer in Google Sheets (Doubles-Pairing sheet, Points table). The app handles what it does well: CSV import, attendance, pair-level scheduling and scoring, and the public display board.

---

## 4. Production launch readiness

### Infrastructure accounts not yet provisioned

| Service | Purpose | Free tier |
|---|---|---|
| **Neon** | PostgreSQL | 0.5 GB, scales to zero |
| **Railway** (recommended) | FastAPI host | ~$5/mo Hobby, no spin-down |
| **Vercel** | Next.js frontend | Free Hobby |
| **Cloudflare R2** | File storage | 10 GB, zero egress |
| **Resend** | Transactional email | 3,000/mo |
| **Sentry** | Error tracking | 5,000 errors/mo |

> **Railway vs Render:** Render's free tier cold-starts after ~15 min idle and drops SSE connections — which breaks live scoring mid-match. Use Railway Hobby on event days.

### Minimum steps to go live

1. Apply the Neon `statement_cache_size` fix (~10 min)
2. Provision Neon → Railway → Vercel → R2 → Resend → Sentry (~1 day)
3. Run `alembic upgrade head` against the direct Neon URL
4. Smoke test (see `docs/PRODUCTION-LAUNCH.md` for the full checklist)
5. Create the organizer account via `/register`

### Key environment variables

```bash
# Backend (Railway)
DATABASE_URL=postgresql+asyncpg://...pooler.neon.tech/...   # pooled — app
DIRECT_URL=postgresql://...neon.tech/...                    # direct — migrations only
JWT_SECRET=<32-byte-random-hex>
COOKIE_SECURE=true
COOKIE_DOMAIN=.yourdomain.com
RESEND_API_KEY=re_xxxx
R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET / R2_ENDPOINT_URL

# Frontend (Vercel)
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

Full env var reference: `docs/PRODUCTION-LAUNCH.md`.

---

## 5. Recommended build order for SIBL (features to ship before July)

If time permits, these are the highest-impact additions in priority order:

| Priority | Feature | Why |
|---|---|---|
| **P0** | Neon pooling fix (`statement_cache_size: 0`) | Required before any production deploy |
| **P1** | Umpire role + score entry delegation | Organizer can't personally enter every score in real time |
| **P1** | Mobile live scorekeeper (tap-per-point) | Umpires need a phone-friendly interface at the court |
| **P2** | Pre-formed pair import (partner column in CSV) | Honors SurveyMonkey "do you have a partner" field automatically |
| **P3** | Registration confirmation email | Basic participant communication |
| **P4** | Draw published notification email | Lets participants know the bracket is live |
| **P5** | Public self-registration page | Removes need for organizer to import CSV manually |

Features P1–P2 are mandatory for a smooth on-day operation. P3–P5 improve participant communication but can be worked around with manual announcements.

---

## 6. What the app can run today (end-to-end flow)

This is the complete flow the app supports right now, with zero new code:

```
1. Organizer creates org + tournament + division in the console
2. Organizer exports SurveyMonkey CSV → imports via the import wizard
3. Import wizard maps columns (Name, Email, Skill, Format, Partner)
4. Participants appear in the registrations table (auto-approved or manual review)
5. Event day: organizer checks in players via the attendance console (keyboard shortcuts)
6. Readiness dashboard shows green when threshold is met
7. Organizer generates draw (round-robin groups + knockout)
8. Organizer assigns matches to courts and time slots (drag-and-drop)
9. Match-called notification fires (in-app + email once RESEND_API_KEY is set)
10. After each match: organizer enters final game scores
11. Standings update live; public microsite shows live bracket + scores
12. Knockout rounds auto-advance; champion declared
13. Final standings and bracket visible on the public microsite
```

Steps 1–13 all work today. The only on-day gaps are: umpire delegation (step 9 must be done by the organizer) and mobile tap scoring (step 10 requires typing scores, not tap-per-point).
