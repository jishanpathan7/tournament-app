# SIBL Badminton 2026 — App Readiness Report

> Updated: 2026-07-03. Target event: last week of July 2026.

This document captures the current state of the tournament platform specifically for the SIBL badminton event, what's built, what's missing, and the key findings from our assessment sessions.

---

## 1. What is fully built and working

| Feature | Status | Notes |
|---|---|---|
| Auth (register, login, verify, password reset, org invites) | ✅ Complete | Cookie-based JWT, HTTP-only |
| Org + Tournament + Division CRUD | ✅ Complete | Full organizer console |
| Registrations (organizer-side approve / reject / waitlist) | ✅ Complete | Capacity caps, admin table |
| **Public self-registration** (`/t/[slug]/register`) | ✅ Complete | No login required; links from microsite |
| SurveyMonkey CSV import | ✅ Complete | Column mapping, preview, commit pipeline; **partner name column** honored |
| Attendance check-in console | ✅ Complete | Bulk + keyboard shortcut check-in |
| **QR self check-in** (`/checkin/[token]`) | ✅ Complete | Division-scoped revocable link + QR on attendance console |
| Readiness dashboard + draw gate | ✅ Complete | Blocks draw until attendance threshold met; organizer override; **squad assignment blockers** |
| **Franchise teams (Squads)** | ✅ Partial | Squad CRUD, snake-draft auto-assign, manual assign, captain; **cross-squad pairing constraint** |
| Smart pairing engine (FoldPairingEngine) | ✅ Complete | Skill-balanced doubles pair formation; honors pre-formed pairs; **forbids same-squad pairs** |
| Draw generation | ✅ Complete | Round-robin, knockout, group+KO; organizer-controlled |
| Scoring + standings | ✅ Complete | Score entry, live standings, full tie-break chain, result lock |
| **Mobile court scorekeeper** (`/scorekeeper/[token]`) | ✅ Complete | Tap-per-point badminton scoring; match-scoped token; invite email optional |
| **Scorekeeper org role** | ✅ Complete | Can score without full tournament admin |
| Court management | ✅ Complete | Court CRUD, drag-and-drop schedule timeline, conflict detection |
| Match scheduling | ✅ Complete | Assign matches to courts + time slots |
| Public microsite (`/t/[slug]`) | ✅ Complete | Bracket, standings, fixtures, live scores — no login required |
| **Participant portal** (`/portal`) | ✅ Complete | Multi-org schedule, match history, registrations + participations |
| Notifications infrastructure | ✅ Complete | DB model, in-app delivery, email dispatch queue, outbox worker |
| **Notification bell UI** | ✅ Complete | Topbar inbox with read/unread |
| Registration notification emails | ✅ Wired | Needs `RESEND_API_KEY` in production |
| Draw published notification | ✅ Email + in-app | Fires on publish; email needs Resend |
| Schedule / scoring notifications | ✅ Complete | `notify()` fires on match assigned, rescheduled, scored, advanced |
| Auth email templates | ✅ Complete | `verify_email`, `password_reset`, `org_invite` |
| Neon pooling fix | ✅ Applied | `statement_cache_size: 0` in `apps/api/app/core/db.py` |

---

## 2. What is still missing for the SIBL event

### 2a. Participant experience — minor gaps

| Gap | Status |
|---|---|
| **Portal match schedule / draw position** | ✅ Built — `/portal` shows upcoming matches across all org memberships |
| **Portal match history** | ✅ Built — recent results on `/portal` |

### 2b. Franchise-team format — remaining engine work

| Franchise-team concept | App support |
|---|---|
| Team-vs-team match container (a "tie" = N doubles games, aggregate winner) | ✅ Built |
| Team standings (win/loss at squad level) | ✅ Built (franchise stage standings) |
| Finals bracket at squad level | ✅ Built — `POST /stages/{id}/franchise-knockout-draw` seeds from RR standings |

**What works today for franchise teams:**
- Create 4/6/8 squads; auto snake-draft or manual assign by registration
- Within-squad doubles pairing (pairs must belong to one franchise team)
- Squad round-robin ties + knockout finals with leg expansion on advancement
- Readiness dashboard surfaces unassigned squad members

### 2c. Production deploy prerequisites

| Item | Status |
|---|---|
| Neon `statement_cache_size: 0` | ✅ Fixed in code |
| Provision Neon / Railway / Vercel / R2 / Resend | ⏳ Accounts not yet provisioned |
| `alembic upgrade head` (includes `0014_squads`, `0015_checkin_links`) | ⏳ Run against direct Neon URL before go-live |
| Set `RESEND_API_KEY` | ⏳ Required for registration/draw/scorekeeper emails |

---

## 3. The franchise-team format — current architecture

### What the SIBL event needs

1. All participants register (SurveyMonkey or public form)
2. Four captains assigned; players distributed across squads by skill (snake draft)
3. Doubles pairs formed **across squads** (never two players from the same squad)
4. Matches are **team vs team** — multiple doubles games; squad with more game wins wins the tie
5. Squad-level standings and a finals round

### What the app has now

| Layer | Status |
|---|---|
| `Squad` / `SquadMember` models + Teams console | ✅ Built |
| Snake-draft distribution engine | ✅ Built |
| Cross-squad pairing forbidden pairs | ✅ Built |
| Team-tie match container + squad standings | ✅ Built |

The app's `Team` entity still means **a doubles pair (2 players)** — not a franchise squad. UI uses **Teams** for squads to avoid naming collision.

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

1. Provision Neon → Railway → Vercel → R2 → Resend → Sentry (~1 day)
2. Run `alembic upgrade head` against the direct Neon URL
3. Smoke test (see `docs/PRODUCTION-LAUNCH.md` for the full checklist)
4. Create the organizer account via `/register`
5. Set `RESEND_API_KEY` for participant emails

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

## 5. Recommended pre-event checklist

| Step | Action |
|---|---|
| 1 | Run migrations (`0014_squads`, `0015_checkin_links`) |
| 2 | Import SurveyMonkey CSV (include Partner column for pre-formed pairs) |
| 3 | Assign franchise **Teams** (squads) — auto 4-team snake draft or manual |
| 4 | Run pairing review (cross-squad pairs enforced) |
| 5 | Event day: display QR check-in at venue; fallback to attendance console |
| 6 | Generate draw after readiness green; publish to public site |
| 7 | Share court scorekeeper links (or email invites) to umpires |
| 8 | Direct players to `/portal` or public microsite for status |

---

## 6. End-to-end flow (supported today)

```
1. Organizer creates org + tournament + division in the console
2. Participants register via public form OR SurveyMonkey CSV import
3. Organizer assigns franchise Teams (squads) — snake draft or manual
4. Pairing engine forms cross-squad doubles pairs
5. Event day: QR self check-in OR attendance console (keyboard shortcuts)
6. Readiness dashboard shows green when check-in + squad assignment complete
7. Organizer generates draw (round-robin groups + knockout)
8. Organizer assigns matches to courts; scorekeeper links sent to umpires
9. Umpires score live from phone (/scorekeeper/[token])
10. Standings update live; public microsite shows live bracket + scores
11. Organizer publishes draw → email + in-app notification to participants
12. Knockout rounds auto-advance; champion declared
13. Players check status at /portal or public microsite
```

**Not in this flow yet:** squad-level knockout finals (generate a second single-elim stage on squad participants if needed).
