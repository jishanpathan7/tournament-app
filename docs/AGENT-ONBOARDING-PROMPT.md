# Agent Onboarding Prompt

> Copy and paste this entire block as your first message when starting a new AI coding session on this project.

---

```
You are taking over development of a multi-sport Tournament Management Platform (SaaS).
The first real event it must run is the SIBL internal badminton tournament, targeting the
last week of July 2026. The platform is architected to handle any sport later (cricket,
table tennis, chess, esports) without schema or engine changes.

---

## BEFORE YOU WRITE ANY CODE

Read these four files in full — they are the source of truth:

1. CLAUDE.md                    — project overview, tech stack, conventions, the one governing rule
2. ENGINEERING_GUIDELINES.md    — how we build: reuse-first rule, folder structure, coding standards,
                                   testing requirements, PR checklist. READ THIS BEFORE TOUCHING CODE.
3. docs/SIBL-READINESS.md       — current state of the app, what's built, what's missing, and all key
                                   findings about what's needed to run the SIBL event
4. docs/PRODUCTION-LAUNCH.md    — what's needed to go live on prod, infra accounts, env vars, deploy order

For deep dives: Platform-Product-Spec.md (vision + data model), Technical-Architecture.md
(system design), docs/STACK.md (pinned versions), docs/DESIGN-SYSTEM.md (UI/UX).

---

## THE ONE RULE — never break this

Three layers stay permanently separate:

  Format Engine   → apps/api/app/engine/     (sport-agnostic; knows only abstract outcomes)
  Sport Profile   → apps/api/app/sports/     (pluggable per sport; win/draw rules, pairing policy)
  Domain Core     → Organization → Tournament → Division → Stage → Group/Round → Match → Standing

If you ever write `if sport == "badminton"` anywhere outside apps/api/app/sports/, STOP.
A Match stores a generic JSON result_payload validated by its Sport Profile.
Adding a new sport = one new file in sports/, not a migration.

---

## TECH STACK (pinned — do not upgrade without checking docs/STACK.md)

Frontend:  Next.js 15 (App Router, RSC) · React 19 · TypeScript strict · Tailwind 3.4
           shadcn/ui · TanStack Query · axios (withCredentials) · react-hook-form + zod
           lucide-react · sonner · framer-motion · recharts · qrcode.react
Backend:   Python FastAPI (async) · SQLAlchemy 2.0 + asyncpg · Alembic · Pydantic v2
Data:      PostgreSQL (Neon) · Cloudflare R2 (file storage) · Resend (email)
Auth:      HTTP-only cookie JWT — NO bearer tokens in JS, ever
Package:   yarn workspaces (yarn.lock only — never package-lock.json)
Deploy:    Frontend → Vercel · Backend → Railway · DB → Neon

---

## WHAT IS ALREADY BUILT (do not rebuild)

- Auth (register, login, verify, password reset, org invites)
- Org / Tournament / Division CRUD + organizer console
- Registrations (approve / reject / waitlist, capacity caps)
- SurveyMonkey CSV import wizard (column mapping, preview, commit)
- Attendance check-in console (bulk + keyboard shortcuts)
- Readiness dashboard + draw gate (blocks draw until attendance threshold; override)
- Smart pairing engine — FoldPairingEngine, skill-balanced doubles pair formation
- Draw generation — round-robin, knockout, group+KO; organizer-controlled
- Scoring + standings — score entry, live standings, full tie-break chain, result lock
- Court management + drag-and-drop scheduling timeline + conflict detection
- Public microsite /t/[slug] — bracket, standings, fixtures, live scores (no login required)
- Notifications infrastructure — DB model, in-app delivery, email dispatch queue, outbox worker
- Schedule / scoring notifications — notify() fires on match assigned, rescheduled, scored, advanced

---

## WHAT IS MISSING (priority order for the SIBL event)

P0 — REQUIRED before any production deploy:
     Add connect_args={"statement_cache_size": 0} to create_async_engine() in
     apps/api/app/core/db.py. Neon uses PgBouncer in transaction mode; asyncpg
     auto-prepares statements causing intermittent "prepared statement does not exist" errors.

P1 — Mandatory for smooth on-day operation:
     • Umpire / scorekeeper role — dedicated account type for court-side score entry
     • Mobile live scorekeeper — tap-per-point interface (mockup: docs/mockups/scorekeeper-mobile.html)
     • Pre-formed pair import — honor a "partner name" column in the CSV import

P2 — Important for participant communication:
     • Registration confirmation + approval/rejection emails (templates + notify() calls)
     • Draw published notification email

P3 — Good to have before July:
     • Public self-registration page — /t/[slug]/register
     • Participant portal — authenticated view of own schedule and results

NOT SUPPORTED (requires new feature work, estimated 2–3 weeks):
     The franchise-team / squad format (4 captains, players distributed across squads,
     team-vs-team ties). The app is built for pair/individual-level competition.
     See docs/SIBL-READINESS.md §3 for full analysis.

---

## LOCAL DEV — key gotchas

Start everything:          ./run.sh start
Stop everything:           ./run.sh stop
Status:                    ./run.sh status
Tail logs:                 ./run.sh logs

IMPORTANT: macOS Homebrew may install Python 3.14 as `python3`.
The project venv is Python 3.13. Always use:
  .venv/bin/python         (not python3 or python)
  .venv/bin/python -m pytest
  .venv/bin/python -m black .

Quality gate before any PR (must all pass):
  Backend:   cd apps/api && .venv/bin/python -m pytest && .venv/bin/python -m black --check . && .venv/bin/python -m flake8
  Frontend:  cd apps/web && yarn typecheck && yarn lint && yarn test run

Line length limit: 100 chars (black + flake8 both enforce this).

---

## ARCHITECTURE CONVENTIONS

API:
- All routes under APIRouter(prefix="/api/v1"). CORS mounted after routers.
- String UUID ids on every row — never leak sequence ids externally.
- PATCH uses clear_<field>: true flags — never overload null to mean "clear".
- Backend modules are vertical slices: router · service · repository · schemas · events

Frontend:
- Data fetching: generated API client in packages/api-client — never hand-write fetch/axios calls.
- Forms: react-hook-form + zod schema validation.
- State: TanStack Query for server state; no global client state library.
- Routing: Next.js App Router; route groups (console), (portal), (public), (auth).
- Alias: @/ → src/. Single env var: NEXT_PUBLIC_API_URL (client appends /api/v1).

Comments: write NO comments unless the WHY is non-obvious. No docstrings.
Tests: every new module needs tests. Integration tests hit a real DB — no mocking the DB layer.

---

## HOW TO CONTRIBUTE

1. Read the four onboarding files listed at the top.
2. Check ENGINEERING_GUIDELINES.md §0 (reuse-first) before writing anything new.
3. Branch off main. Do not commit or push unless explicitly asked.
4. Run the full quality gate before declaring work done.
5. One PR per feature/fix. Conventional Commits format.
6. If you're unsure about scope: Platform-Product-Spec.md for features,
   Technical-Architecture.md for mechanisms, docs/PRODUCTION-LAUNCH.md for infra.

The codebase owner is Jishan Pathan. Ask before making architectural decisions.
```
