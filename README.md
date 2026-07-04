# Playlane

A multi-sport tournament management platform (SaaS). It runs real competitions end-to-end — registration, fair draws, scheduling, live scoring, standings, and public sharing — and is architected so **any sport** can be added by writing a *Sport Profile*, not by changing the system.

**First use case:** the internal SIBL badminton tournament (last week of July 2026).

> **Status:** architecture & planning complete; implementation not yet started. This repo currently holds the design docs and scaffolding.

## Why it's different

- **Truly multi-sport** — a generic Format Engine + pluggable Sport Profiles, not a badminton app with a sport dropdown.
- **Fair & transparent** — published seeding logic, automated tie-breaks, full audit trail.
- **Live & public** — real-time scoring with shareable, CDN-cached public pages and QR access.
- **Runs free at MVP** — Vercel + Railway/Render + Neon + Cloudflare R2 + Resend; upgrades in place as traffic grows.

## Tech stack

| Layer | Tech | Host |
|---|---|---|
| Frontend | Next.js 15, React, TypeScript, Tailwind, shadcn/ui | Vercel |
| Backend | Python FastAPI, SQLAlchemy 2.0, Pydantic v2 | Railway / Render |
| Database | PostgreSQL | Neon |
| Storage | S3-compatible | Cloudflare R2 |
| Email | Transactional | Resend |

## Repository layout

```
apps/
  web/          Next.js frontend — console, participant portal, public microsite
  api/          FastAPI backend — domain modules, engine (formats), sports (profiles), workers
packages/
  api-client/   TypeScript client + types generated from the API's OpenAPI schema
  ui/           Shared shadcn/ui design system
  config/       Shared eslint / tsconfig / tailwind preset
  shared/       Shared TS utilities and form schemas
docs/           Deployment, interface contracts, and the documentation index
```

## Documentation

| Doc | What's inside |
|---|---|
| [docs/README.md](docs/README.md) | Documentation index (start here) |
| [Platform-Product-Spec.md](Platform-Product-Spec.md) | Product vision, personas, flows, features, data model, MVP, roadmap |
| [Technical-Architecture.md](Technical-Architecture.md) | Full technical design + free-tier hosting plan |
| [docs/STACK.md](docs/STACK.md) | Pinned tech stack — what we kept/dropped from the blueprint |
| [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) | Complete UI/UX design system ("Candy Sticker") + themed screen mockups |
| [ENGINEERING_GUIDELINES.md](ENGINEERING_GUIDELINES.md) | How we build — standards for all future development (humans + AI) |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Step-by-step free-tier deployment + env vars |
| [docs/INTERFACES.md](docs/INTERFACES.md) | Swappable infra contracts (the free→paid seam) |
| [Tournament-Playbook.md](Tournament-Playbook.md) | The badminton event's organizing rules + fairness engine |
| [CLAUDE.md](CLAUDE.md) | Working context & conventions for contributors / AI sessions |

## Getting started

Prerequisites: Node ≥ 18.18 (`.nvmrc` pins 18.20.4), yarn 1.x, Python 3.13. Optional: Docker for local Postgres.

```bash
# Backend (FastAPI) — http://127.0.0.1:8000/api/v1/health
cd apps/api
python3.13 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000

# Frontend (Next.js) — http://localhost:3000  (run from repo root)
yarn install
cp apps/web/.env.local.example apps/web/.env.local
yarn --cwd apps/web dev
```

Optional local database: `docker compose up -d`, set `DATABASE_URL` in `apps/api/.env`, then `cd apps/api && alembic upgrade head`.

Full workflow, conventions, and the "definition of done" checklist live in [ENGINEERING_GUIDELINES.md](ENGINEERING_GUIDELINES.md). Pinned stack: [docs/STACK.md](docs/STACK.md). Hosted deploy: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## License

Internal project. Not for public distribution yet.
