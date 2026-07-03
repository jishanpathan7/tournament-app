# Local Development Setup Guide

Complete, repeatable steps to get both the backend and frontend running from a fresh clone.

---

## Prerequisites

| Tool | Required version | Install |
|---|---|---|
| **Node.js** | 18.20.4 (pinned in `.nvmrc`) | `nvm install` from repo root |
| **yarn** | 1.x (never npm) | `npm install -g yarn` |
| **Python** | 3.13 exactly | `brew install python@3.13` |
| **Docker Desktop** | any recent | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |

> **Why Python 3.13 specifically?** The venv is built against 3.13. On macOS with Homebrew, `python3` often resolves to a newer version (e.g. 3.14). Using the wrong Python breaks native extensions like `pydantic-core`. Always use `python3.13` or, after venv activation, `python` / `.venv/bin/python`.

> **No Redis needed at MVP.** The API runs an in-process job poller. Redis (via Upstash) is only added when scaling to multiple instances.

---

## First-time setup

Run these once after cloning. Order matters.

### 1 — Install JS dependencies

```bash
# From the repo root
yarn install
```

This installs all workspaces: `apps/web`, `packages/api-client`, `packages/ui`, etc.

### 2 — Create the frontend env file

```bash
cp apps/web/.env.local.example apps/web/.env.local
```

The file contains one variable:

```
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

> Use `127.0.0.1`, **not** `localhost`. Node sometimes resolves `localhost` to IPv6 `::1` while uvicorn binds to IPv4, causing connection-refused errors.

### 3 — Create the backend virtualenv

```bash
cd apps/api
python3.13 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### 4 — Create the backend env file

```bash
cp .env.example .env
```

Then open `apps/api/.env` and **uncomment the DATABASE_URL line**:

```bash
# Before (commented out):
# DATABASE_URL=postgresql+asyncpg://tournament:tournament@localhost:5432/tournament

# After:
DATABASE_URL=postgresql+asyncpg://tournament:tournament@localhost:5432/tournament
```

> If port 5432 is occupied on your machine (e.g. by a local Postgres install or SSH tunnel), see [Port conflicts](#port-conflicts) below.

### 5 — Start Postgres and run migrations

```bash
# From repo root — starts a Postgres 16 container on localhost:5432
docker compose up -d

# Wait for the healthcheck (a few seconds), then migrate
cd apps/api
.venv/bin/python -m alembic upgrade head
```

Successful migration output ends with a line like:

```
INFO  [alembic.runtime.migration] Running upgrade 0011_... -> 0012_registration_ops
```

---

## Starting the app

### Single command (recommended)

```bash
./run.sh start
```

This script starts Postgres (Docker), the FastAPI backend, and the Next.js frontend in the background. Logs go to `.run/api.log` and `.run/web.log`.

```
==> Up. Logs: ./run.sh logs   Stop: ./run.sh stop
    Web  http://localhost:3000
    API  http://127.0.0.1:8000/docs
```

Other `run.sh` subcommands:

| Command | Effect |
|---|---|
| `./run.sh start` | Start Postgres + API + Web |
| `./run.sh stop` | Gracefully stop all three |
| `./run.sh restart` | Stop then start |
| `./run.sh status` | Show what is running |
| `./run.sh logs` | Tail API + Web logs live (Ctrl-C detaches; apps keep running) |
| `./run.sh start --no-db` | Skip Postgres (API runs without a DB; `/health` still works) |

### Three-terminal alternative

If you prefer to see live output directly:

**Terminal 1 — Postgres**
```bash
docker compose up
```

**Terminal 2 — API**
```bash
cd apps/api
source .venv/bin/activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 3 — Web**
```bash
yarn --cwd apps/web dev
```

---

## What successful startup looks like

### Backend

```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

Verify with:
```bash
curl http://127.0.0.1:8000/api/v1/health
# → {"status":"ok","db":"ok","environment":"development"}
```

Interactive docs: `http://127.0.0.1:8000/docs`

### Frontend

```
  ▲ Next.js 15.x.x
  - Local:        http://localhost:3000
  - Network:      http://192.168.x.x:3000
  ✓ Ready in 2.1s
```

Open `http://localhost:3000` — you should see the Tournament Platform console shell.

---

## Port conflicts

Check which ports are in use before starting:

```bash
lsof -i:5432 -sTCP:LISTEN   # Postgres
lsof -i:8000 -sTCP:LISTEN   # API
lsof -i:3000 -sTCP:LISTEN   # Web
```

Kill a process on a specific port:

```bash
lsof -ti:8000 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

### Port 5432 already occupied (common on Mac)

If you have a local Postgres install or an SSH tunnel forwarding on `:5432`, the Docker container won't bind. Two options:

**Option A — remap Docker to a different host port** (edit `docker-compose.yml`):
```yaml
ports:
  - "5433:5432"   # host:container
```
Then update `DATABASE_URL` in `apps/api/.env`:
```
DATABASE_URL=postgresql+asyncpg://tournament:tournament@localhost:5433/tournament
```

**Option B — stop the conflicting process**:
```bash
# Find and kill whatever holds :5432
lsof -ti:5432 | xargs kill -9
```

### Stale `run.sh` PIDs

If `./run.sh status` shows services running but they crashed:

```bash
./run.sh stop     # cleans up stale pidfiles
./run.sh start
```

---

## Common issues and fixes

### `ModuleNotFoundError: No module named 'pydantic_core._pydantic_core'`

**Cause:** Running `python3` (which may be 3.14 on macOS) against a venv built with 3.13. Native extensions are Python-version-specific binaries.

**Fix:** Always use the venv's own binary:
```bash
# Instead of:   python3 -m uvicorn ...
# Use:
.venv/bin/python -m uvicorn app.main:app --reload --port 8000
# OR activate first:
source .venv/bin/activate && uvicorn app.main:app --reload --port 8000
```

`run.sh` already does this correctly — it calls `.venv/bin/python` directly.

### `Error: listen EADDRINUSE :::3000`

Another Next.js process is still running (often a leftover from a previous `./run.sh start`).

```bash
./run.sh stop          # kills tracked processes
lsof -ti:3000 | xargs kill -9   # kills any untracked one
./run.sh start
```

### API returns `{"status":"ok","db":"unavailable"}`

`DATABASE_URL` is not set in `apps/api/.env`, or Postgres isn't running.

```bash
docker compose up -d
# Check the DB is actually healthy:
docker compose ps
```

### `alembic upgrade head` fails with `connection refused`

Postgres container isn't ready yet. Wait a few seconds after `docker compose up -d` for the healthcheck to pass:

```bash
docker compose ps   # wait until State = healthy
.venv/bin/python -m alembic upgrade head
```

### Frontend shows a blank page or network errors in console

Check that `apps/web/.env.local` exists and contains the correct API URL:
```
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```
Do **not** use `localhost` here — see note in setup step 2.

### `yarn install` fails or uses wrong lockfile

This repo uses **yarn 1.x only**. Never run `npm install`. If a `package-lock.json` appears, delete it.

```bash
rm -f package-lock.json apps/web/package-lock.json
yarn install
```

### Black/flake8/mypy fail locally but not in CI (or vice versa)

The repo requires the venv Python for all quality tools — not system-level installations:

```bash
cd apps/api
.venv/bin/python -m black --check .
.venv/bin/python -m flake8
.venv/bin/python -m mypy app
.venv/bin/python -m pytest
```

---

## Quality gate (run before opening a PR)

```bash
# Frontend (from repo root)
yarn --cwd apps/web typecheck
yarn --cwd apps/web lint
yarn --cwd apps/web build
yarn format:check

# Backend (from apps/api)
.venv/bin/python -m black --check app tests
.venv/bin/python -m isort --check-only app tests
.venv/bin/python -m flake8 app tests
.venv/bin/python -m mypy app
.venv/bin/python -m pytest
```

> CI runs the same checks against a live Postgres. Pytest tests that require `DATABASE_URL` are automatically skipped when run without a database — so local unit tests pass without Docker.

---

## Environment variable reference

### `apps/api/.env`

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | _(unset)_ | Postgres connection string. Required for DB features. |
| `JWT_SECRET` | `dev-insecure-change-me` | Signs access tokens. Use a 32+ byte random value in production. |
| `ENVIRONMENT` | `development` | Controls logging format and startup validators. |
| `APP_BASE_URL` | `http://localhost:8000` | Self-referencing base URL (email links, OAuth redirect). |
| `FRONTEND_URL` | `http://localhost:3000` | CORS allow-origin and email link base. |
| `COOKIE_SECURE` | `false` | Must be `true` in production (HTTPS required). |
| `RESEND_API_KEY` | _(unset)_ | Email delivery. Emails print to logs when unset. |
| `GOOGLE_CLIENT_ID` | _(unset)_ | OAuth. Endpoints return 501 until all three `GOOGLE_*` vars are set. |
| `R2_ACCESS_KEY_ID` | _(unset)_ | Object storage. Falls back to local `.storage/` disk when unset. |
| `SENTRY_DSN` | _(unset)_ | Error tracking. Disabled when unset. |

### `apps/web/.env.local`

| Variable | Value | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:8000` | Base URL the browser uses to reach the API. |

---

## Project URLs summary

| URL | What |
|---|---|
| `http://localhost:3000` | Console (org/tournament management) |
| `http://localhost:3000/portal/[slug]` | Participant portal |
| `http://localhost:3000/t/[slug]` | Public tournament microsite |
| `http://127.0.0.1:8000/docs` | FastAPI Swagger UI |
| `http://127.0.0.1:8000/redoc` | FastAPI ReDoc |
| `http://127.0.0.1:8000/api/v1/health` | Health check |
